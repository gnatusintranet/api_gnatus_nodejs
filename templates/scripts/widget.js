window.onload = () => {
  render(
    [
      {
        styles: {
          position: "fixed",
          width: "400px",
          height: "600px",
          backgroundColor: "yellow",
          bottom: "0px",
          right: "50px",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 0px 10px black",
        },
        children: [
          {
            styles: {
              height: "40px",
              backgroundColor: "blue",
            },
          },
          {
            styles: {
              height: "40px",
              backgroundColor: "purple",
              flexGrow: 1,
            },
          },
          {
            styles: {
              height: "40px",
              backgroundColor: "red",
            },
          },
        ],
      },
    ],
    {
      appendChild: (it) => document.body.insertAdjacentElement("beforeend", it),
    }
  );
};

function render(items, container) {
  items.forEach(({ type, styles, children }) => {
    const elm = document.createElement(type || "div");

    Object.entries(styles || {}).forEach(([key, value]) => {
      elm.style[key] = value;
    });

    render(children || [], elm);

    container.appendChild(elm);
  });
}
