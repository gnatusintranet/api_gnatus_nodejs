const fs = require('fs');
const path = require('path');
const moment = require('moment');

const jobsByName = {};

module.exports = (app, opt) => {
    const { BackgroundJobs } = app.models;

    const optionsDefaults = {
        retryAfter: 10,
        priority: 1,
        attemps: 10
    };

    fs.readdirSync(opt.directory).map(n => path.join(opt.directory, n)).forEach(it => {
        if (it.endsWith('.js')) {
            const { name, options, handler } = require(it)(app);
            jobsByName[name] = { options: { ...optionsDefaults, ...(options || {}) }, handler };
        }
    });

    const runner = async () => {
        const jobsToProcess = await BackgroundJobs.find({ runAt: { $lte: new Date() }, status: { $in: ['waiting', 'retring'] } }, { executions: 0 }).sort({ priority: -1 }).limit(1).lean();

        if (jobsToProcess.length === 0) {
            setTimeout(runner, 5000);
            return;
        }

        const job = jobsToProcess[0];

        const jobData = jobsByName[job.name];
        if (jobData) {
            const startAt = new Date();
            try {
                const update = await BackgroundJobs.updateOne({ _id: job._id }, { $set: { status: 'running' } });
                if (update.nModified === 0) {
                    setTimeout(runner, 0);
                    return;
                }

                await jobData.handler(job.data);

                const endAt = new Date();

                await BackgroundJobs.updateOne({ _id: job._id }, {
                    $set: { status: 'success' },
                    $push: {
                        executions: {
                            startAt: startAt,
                            endAt: endAt,
                            elapsedTime: (endAt - startAt) * 0.001,
                            success: true
                        }
                    }
                });
            }
            catch (e) {
                const endAt = new Date();

                if (e && e['stack'] && e['message']) {
                    e = { error: e.message };
                }

                const isFail = (job.fails + 1) >= job.attemps;

                await BackgroundJobs.updateOne({ _id: job._id }, {
                    $set: {
                        status: isFail ? 'error' : 'retring',
                        runAt: moment().add(jobData.options.retryAfter, 'seconds').toDate()
                    },
                    $inc: { fails: 1 },
                    $push: {
                        executions: {
                            startAt: startAt,
                            endAt: endAt,
                            elapsedTime: (endAt - startAt) * 0.001,
                            success: false,
                            data: e
                        }
                    }
                });
            }

            setTimeout(runner, 0);
        }
    }

    app.jobs = {
        now: async (name, data) => {
            const jobData = jobsByName[name];
            if (!jobData) return null;

            const job = await BackgroundJobs.create({
                name,
                data,
                runAt: new Date(),
                priority: jobData.options.priority,
                attemps: jobData.options.attemps,
                frequency: 'once'
            });

            return job._id.toString();
        },
        schedule: async (date, name, data) => {
            const jobData = jobsByName[name];
            if (!jobData) return null;

            const job = await BackgroundJobs.create({
                name,
                data,
                runAt: moment(date).toDate(),
                priority: jobData.options.priority,
                attemps: jobData.options.attemps,
                frequency: 'once'
            });

            return job._id.toString();
        }
    }

    setTimeout(runner, 0);
}