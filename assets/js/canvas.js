import { fabric } from "fabric";

export default {
  mounted() {
    this.currentMask = null;
    this.isMasking = false;
    this.canDrag = false;

    this.handleEvent(
      "render_initial_generations",
      this.renderInitialGenerationsOnCanvas.bind(this)
    );

    this.handleEvent(
      "generated_image_prompt",
      this.handleImagePrompt.bind(this)
    );
    this.handleEvent(
      "generated_image",
      this.renderGeneratedImageOnCanvas.bind(this)
    );

    this.canvas = new fabric.Canvas("canvas", {
      centeredScaling: true,
      selection: false,
      backgroundColor: "#808080",
    });

    const canvas = this.canvas;

    canvas.setWidth(window.innerWidth);
    canvas.setHeight(window.innerHeight);
    canvas.freeDrawingBrush.width = 10;

    let lastPosX = null;
    let lastPosY = null;

    canvas.on("mouse:down", (opt) => {
      const evt = opt.e;

      if (this.canDrag) {
        canvas.isDragging = true;

        lastPosX = evt.clientX;
        lastPosY = evt.clientY;
      }
    });
    canvas.on("mouse:move", (opt) => {
      if (this.canDrag) {
        canvas.setCursor("grab");
      }

      if (canvas.isDragging) {
        canvas.setCursor("grabbing");
        const e = opt.e;
        const vpt = canvas.viewportTransform;
        vpt[4] += e.clientX - lastPosX;
        vpt[5] += e.clientY - lastPosY;
        canvas.requestRenderAll();
        lastPosX = e.clientX;
        lastPosY = e.clientY;
      }
    });

    canvas.on("mouse:up", (opt) => {
      if (canvas.isDragging) {
        // on mouse up we want to recalculate new interaction
        // for all objects, so we call setViewportTransform
        canvas.isDragging = !canvas.isDragging;
        canvas.setViewportTransform(canvas.viewportTransform);
      }
    });

    let isDrawing = false;
    let color = "black";
    let size = 5;
    let canvasSize = 512;
    let followingStopped = false;

    const followingCanvas = new fabric.Canvas("following-canvas");

    followingCanvas.setWidth(canvasSize);
    followingCanvas.setHeight(canvasSize);
    followingCanvas.freeDrawingBrush.width = 10;
    followingCanvas.freeDrawingBrush.limitToCanvasSize = true;
    followingCanvas.getElement().parentElement.style.position = "absolute";

    followingCanvas.on("mouse:down", freezeCanvas);

    followingCanvas.on("path:created", () => {
      const dataURL = followingCanvas.toDataURL();

      followingCanvas.setBackgroundColor("#ffcc00");
      const canvasEl = followingCanvas.getElement();
      const coords = canvasEl.parentElement.getBoundingClientRect();
      const canvasCoords = canvas.calcViewportBoundaries();

      const originalDrawing = followingCanvas.toDataURL();

      this.pushEvent("send_drawing", {
        drawing: originalDrawing,
        coords: {
          top: coords.top + canvasCoords.tl.y,
          left: coords.left + canvasCoords.tl.x,
        },
      });

      followingCanvas.setBackgroundColor("transparent");

      fabric.Image.fromURL(dataURL, (oImg) => {
        canvas.add(
          oImg.set({
            top: coords.top + canvasCoords.tl.y,
            left: coords.left + canvasCoords.tl.x,
            selectable: false,
          })
        );

        const allImages = canvas.getObjects("image");
        let intersectingObjects = [];

        for (let i = 0; i < allImages.length; i++) {
          if (allImages[i].cacheKey === oImg.cacheKey) continue;

          if (oImg.intersectsWithObject(allImages[i])) {
            intersectingObjects.push(allImages[i]);
          }
        }

        if (intersectingObjects.length > 0) this.isMasking = true;

        const background = new fabric.Rect({
          height: 512,
          width: 512,
          top: coords.top + canvasCoords.tl.y + 1,
          left: coords.left + canvasCoords.tl.x + 1,
          fill: "white",
          selectable: false,
        });

        canvas.add(background);

        intersectingObjects.forEach((obj) => {
          const { bl, tl, br, tr } = obj.lineCoords;

          const isTopLeftInside = oImg.containsPoint(tl);
          const isTopRightInside = oImg.containsPoint(tr);
          const isBottomLeftInside = oImg.containsPoint(bl);
          const isBottomRightInside = oImg.containsPoint(br);

          const bottomLeftInside = {
            top: oImg.lineCoords.tr.y,
            left: oImg.lineCoords.tr.x - Math.abs(oImg.lineCoords.tr.x - bl.x),
            width: Math.abs(oImg.lineCoords.tr.x - bl.x),
            height: Math.abs(oImg.lineCoords.tr.y - bl.y),
          };

          const bottomRightInside = {
            top: oImg.lineCoords.tl.y,
            left: oImg.lineCoords.tl.x,
            width: Math.abs(oImg.lineCoords.tl.x - br.x),
            height: Math.abs(oImg.lineCoords.tl.y - br.y),
          };

          const topLeftInside = {
            top: oImg.lineCoords.br.y - Math.abs(oImg.lineCoords.br.y - tl.y),
            left: oImg.lineCoords.br.x - Math.abs(oImg.lineCoords.br.x - tl.x),
            width: Math.abs(oImg.lineCoords.br.x - tl.x),
            height: Math.abs(oImg.lineCoords.br.y - tl.y),
          };

          const topRightInside = {
            top: oImg.lineCoords.bl.y - Math.abs(oImg.lineCoords.bl.y - tr.y),
            left: oImg.lineCoords.bl.x,
            width: Math.abs(oImg.lineCoords.bl.x - tr.x),
            height: Math.abs(oImg.lineCoords.bl.y - tr.y),
          };

          const rectPosition = isTopLeftInside
            ? topLeftInside
            : isTopRightInside
            ? topRightInside
            : isBottomLeftInside
            ? bottomLeftInside
            : isBottomRightInside
            ? bottomRightInside
            : {};

          const rect = new fabric.Rect({
            ...rectPosition,
            fill: "black",
            selectable: false,
          });

          canvas.add(rect);
        });

        //Get source image
        const mask = canvas.toDataURL({
          height: 512,
          width: 512,
          top: coords.top + canvasCoords.tl.y,
          left: coords.left + canvasCoords.tl.x,
        });

        this.currentMask = mask;

        canvas.remove(mask);
        canvas.remove(background);
        const rectangles = canvas.getObjects("rect");
        canvas.remove(...rectangles);
        canvas.remove(oImg);
      });

      followingCanvas.clear();
      followingStopped = false;
      followingCanvas.isDrawingMode = false;

      // const testing = canvas.toDataURL({
      //   height: 512,
      //   width: 512,
      //   top: coords.top + canvasCoords.tl.y,
      //   left: coords.left + canvasCoords.tl.x,
      // });
      // console.log(testing);
    });

    // setCanvasSize();

    // canvas.addEventListener("mousedown", start(canvas, context));
    // canvas.addEventListener("mouseup", stop(context));
    // canvas.addEventListener("mousemove", draw(canvas, context));
    // canvas.addEventListener("mouseout", stop(context));

    // followingCanvas.addEventListener(
    //   "mousedown",
    //   start(followingCanvas, followingContext)
    // );
    // followingCanvas.addEventListener("mouseup", stop(followingContext));
    // followingCanvas.addEventListener(
    //   "mousemove",
    //   draw(followingCanvas, followingContext)
    // );
    // followingCanvas.addEventListener("mouseout", stop(followingContext));
    // followingCanvas.addEventListener("click", freezeCanvas);

    canvas.on("mouse:wheel", function (opt) {
      const deltaY = opt.e.deltaY;
      let zoom = canvas.getZoom();

      zoom *= 0.999 ** deltaY;

      if (zoom > 1.5) zoom = 1.5;
      if (zoom < 0.2) zoom = 0.2;

      canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);

      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    window.addEventListener("mousemove", setFollowingCanvasPosition);
    window.addEventListener("keydown", enableDrag.bind(this));
    window.addEventListener("keyup", enableDrag.bind(this));

    function setFollowingCanvasPosition(event) {
      if (followingStopped) return;

      const { clientX, clientY } = event;
      const x = clientX - canvasSize / 2;
      const y = clientY - canvasSize / 2;
      const canvasElement = followingCanvas.getElement();

      canvasElement.parentElement.style.left = `${x}px`;
      canvasElement.parentElement.style.top = `${y}px`;
    }

    function freezeCanvas() {
      if (this.canDrag) return;

      followingStopped = true;
      followingCanvas.isDrawingMode = true;
    }

    function enableDrag(event) {
      if (event.code !== "Space" && event.key !== " ") return;

      this.canDrag = event.type === "keydown" ? true : false;
    }
  },
  // Because we cannot export tainted canvas so just convert to Base64 for now
  async getBase64ImageFromUrl(imageUrl) {
    const res = await fetch(imageUrl);
    const blob = await res.blob();

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener(
        "load",
        function () {
          resolve(reader.result);
        },
        false
      );

      reader.onerror = () => {
        return reject(this);
      };
      reader.readAsDataURL(blob);
    });
  },

  renderInitialGenerationsOnCanvas({ generations }) {
    for (const generation of generations) {
      if (!generation.image_url) continue;

      this.getBase64ImageFromUrl(generation.image_url)
        .then((result) => {
          fabric.Image.fromURL(result, (oImg) => {
            if (generation.image_url.includes("replicate")) oImg.scale(0.5);

            this.canvas.add(
              oImg.set({
                top: generation.top,
                left: generation.left,
                selectable: false,
              })
            );
          });
        })
        .catch((err) => console.error(err));
    }
  },
  handleImagePrompt({ prompt, coords }) {
    const baseImage = this.canvas.toDataURL({
      height: 512,
      width: 512,
      top: coords.top,
      left: coords.left,
    });

    const eventName = !this.isMasking
      ? "start_initial_image_generation"
      : "start_inpainting";

    this.pushEvent(eventName, {
      prompt,
      image: baseImage,
      mask: this.currentMask,
      coords: {
        top: coords.top,
        left: coords.left,
      },
    });
  },
  renderGeneratedImageOnCanvas({ image, coords }) {
    this.getBase64ImageFromUrl(image)
      .then((result) => {
        fabric.Image.fromURL(result, (oImg) => {
          // The first generation is 1024x1024 while inpainting produces 512x512 images
          if (!this.isMasking) {
            oImg.scale(0.5);
          }

          this.canvas.add(
            oImg.set({
              top: coords.top,
              left: coords.left,
              selectable: false,
            })
          );

          const rectangles = this.canvas.getObjects("rect");
          this.canvas.remove(rectangles);
        });
      })
      .catch((err) => console.error(err));
  },
};

// get an area with one color from image
