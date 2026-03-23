const fs = require('fs');
const path = require('path');

function capitalizeFirstLetter(string) {
    let slices = string.split('_');
    let finalString = "";

    slices.forEach(slice => {
        slice = slice.replace('_', '');
        finalString += slice.charAt(0).toUpperCase() + slice.slice(1).toLowerCase();
    });

    return finalString;
}

module.exports = (modelsPath, loaderParam) => {
    let ret = {};

    fs.readdirSync(modelsPath).forEach(n => {
        let resourceName = capitalizeFirstLetter(n.replace('.js', ''));
        let item = require(path.join(modelsPath, n));

        if (typeof item === 'function') {
            ret[resourceName] = loaderParam ? item(loaderParam) : item;
        } else {
            ret[resourceName] = item;
        }
    });

    return ret;
};
