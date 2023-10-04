import { fabric } from "fabric";

export default {
  mounted() {
    this.handleEvent("generated_image_prompt", console.log);

    const canvas = new fabric.Canvas("canvas", {
      centeredScaling: true,
      selection: false,
      backgroundColor: "#808080",
    });

    canvas.setWidth(window.innerWidth);
    canvas.setHeight(window.innerHeight);
    canvas.freeDrawingBrush.width = 10;

    let lastPosX = null;
    let lastPosY = null;

    canvas.on("mouse:down", function (opt) {
      const evt = opt.e;

      if (evt.altKey) {
        canvas.isDragging = true;

        lastPosX = evt.clientX;
        lastPosY = evt.clientY;
      }
    });
    canvas.on("mouse:move", function (opt) {
      if (canvas.isDragging) {
        const e = opt.e;
        const vpt = canvas.viewportTransform;
        vpt[4] += e.clientX - lastPosX;
        vpt[5] += e.clientY - lastPosY;
        canvas.requestRenderAll();
        lastPosX = e.clientX;
        lastPosY = e.clientY;
      }
    });
    canvas.on("mouse:up", function (opt) {
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
      const canvasEl = followingCanvas.getElement();
      const coords = canvasEl.parentElement.getBoundingClientRect();
      const canvasCoords = canvas.calcViewportBoundaries();

      this.pushEvent("send_drawing", { drawing: dataURL });
      // this.pushEvent("store_canvas_location", {
      //   top: coords.top + canvasCoords.tl.y,
      //   left: coords.left + canvasCoords.tl.x,
      // });
      // Store canvas location in database
      // Send dataURL to img2prompt (phx event?)
      // render placeholder/loader image on canvas
      // Send received prompt to Stable Diffusion APIs

      fabric.Image.fromURL(dataURL, function (oImg) {
        // const brightness = new fabric.Image.filters.BlackWhite();
        // // const invert = new fabric.Image.filters.Invert();
        // const contrast = new fabric.Image.filters.Contrast({ contrast: 5 });
        // const blur = new fabric.Image.filters.Blur({ blur: 0.5 });
        // oImg.filters.push(brightness);
        // // oImg.filters.push(invert);
        // oImg.filters.push(contrast);
        // oImg.filters.push(blur);
        // oImg.applyFilters();

        canvas.add(
          oImg.set({
            top: coords.top + canvasCoords.tl.y,
            left: coords.left + canvasCoords.tl.x,
            selectable: false,
          })
        );

        // Get source image
        const img = canvas.toDataURL({
          height: 512,
          width: 512,
          top: coords.top + canvasCoords.tl.y,
          left: coords.left + canvasCoords.tl.x,
        });

        canvas.renderAll();

        console.log(img);

        const allImages = canvas.getObjects("image");
        let intersectingObjects = [];

        for (let i = 0; i < allImages.length; i++) {
          if (allImages[i].cacheKey === oImg.cacheKey) continue;

          if (oImg.intersectsWithObject(allImages[i])) {
            intersectingObjects.push(allImages[i]);
          }
        }

        intersectingObjects.forEach((obj) => {
          const { bl, tl, br, tr } = obj.lineCoords;

          const isTopLeftInside = oImg.containsPoint(tl);
          const isTopRightInside = oImg.containsPoint(tr);
          const isBottomLeftInside = oImg.containsPoint(bl);
          const isBottomRightInside = oImg.containsPoint(br);

          const bottomLeftInside = {
            top: oImg.lineCoords.tr.y,
            left: bl.x,
            width: oImg.lineCoords.tr.x - bl.x,
            height: bl.y - oImg.lineCoords.tr.y,
          };

          const bottomRightInside = {
            top: oImg.lineCoords.tl.y,
            left: br.x,
            width: oImg.lineCoords.tl.x - br.x,
            height: br.y - oImg.lineCoords.tl.y,
          };

          const topLeftInside = {
            top: oImg.lineCoords.br.y,
            left: tl.x,
            width: oImg.lineCoords.br.x - tl.x,
            height: tl.y - oImg.lineCoords.br.y,
          };

          const topRightInside = {
            top: oImg.lineCoords.bl.y,
            left: tr.x,
            width: oImg.lineCoords.bl.x - tr.x,
            height: tr.y - oImg.lineCoords.bl.y,
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
            fill: "white",
            selectable: false,
            shadow: "rgba(255,255,255,1) 0px 0px 10px",
          });

          const background = new fabric.Rect({
            height: 513,
            width: 513,
            top: coords.top + canvasCoords.tl.y - 1,
            left: coords.left + canvasCoords.tl.x - 1,
            fill: "black",
            selectable: false,
          });

          canvas.add(background);
          canvas.add(rect);
        });

        //Get source image
        const mask = canvas.toDataURL({
          height: 512,
          width: 512,
          top: coords.top + canvasCoords.tl.y,
          left: coords.left + canvasCoords.tl.x,
        });

        fabric.Image.fromURL(mask, function (maskImage) {
          const blur = new fabric.Image.filters.Blur({ blur: 0.5 });
          // // const brightness = new fabric.Image.filters.BlackWhite();
          maskImage.filters.push(blur);
          // // maskImage.filters.push(brightness);
          maskImage.applyFilters();
          console.log(maskImage.toDataURL());
        });

        // console.log(oImg.toDataURL());
      });

      const rectangles = canvas.getObjects("rect");
      canvas.remove(rectangles);

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

    window.addEventListener("mousemove", setFollowingCanvasPosition);

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
      followingStopped = true;
      followingCanvas.isDrawingMode = true;
    }
  },
};

// get an area with one color from image
