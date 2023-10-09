import { fabric } from "fabric";

export default {
  mounted() {
    this.currentMask = null;
    this.isMasking = false;
    this.canDrag = false;
    this.followingRect = null;
    this.maskCoords = {};
    this.lockPanAndZoom = false;
    this.currentBackgroundColor = "#000";

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

    this.handleEvent("selected_color", this.handleSelectedColor.bind(this));
    this.handleEvent(
      "selected_background_color",
      this.handleSelectedBackgroundColor.bind(this)
    );

    this.handleEvent("accepted_drawing", this.handleAcceptedDrawing.bind(this));

    this.canvas = new fabric.Canvas("canvas", {
      centeredScaling: true,
      selection: false,
      backgroundColor: "#171717",
    });

    const canvas = this.canvas;

    canvas.setWidth(window.innerWidth);
    canvas.setHeight(window.innerHeight);

    let lastPosX = null;
    let lastPosY = null;

    canvas.on("mouse:down", (opt) => {
      const evt = opt.e;

      if (this.lockPanAndZoom) return;

      if (this.canDrag) {
        canvas.isDragging = true;
        lastPosX = evt.clientX;
        lastPosY = evt.clientY;
      }
    });

    canvas.on("mouse:move", (opt) => {
      if (this.lockPanAndZoom) return;

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
      if (this.lockPanAndZoom) return;

      if (canvas.isDragging) {
        // on mouse up we want to recalculate new interaction
        // for all objects, so we call setViewportTransform
        canvas.isDragging = !canvas.isDragging;
        canvas.setViewportTransform(canvas.viewportTransform);

        if (this.followingRect) {
          const { tl } = this.followingRect.lineCoords;

          const followingCanvasWrapper = document.getElementById(
            "following-canvas-wrapper"
          );

          followingCanvasWrapper.style.top = `${tl.y}px`;
          followingCanvasWrapper.style.left = `${tl.x}px`;
        }
      }
    });

    canvas.on("mouse:dblclick", (opt) => {
      if (this.lockPanAndZoom) return;

      if (followingStopped) return;

      canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, 1);

      if (this.followingRect) {
        const { tl } = this.followingRect.lineCoords;

        followingCanvasWrapper.style.top = `${tl.y}px`;
        followingCanvasWrapper.style.left = `${tl.x}px`;
      }

      const followingCanvasWrapper = document.getElementById(
        "following-canvas-wrapper"
      );

      followingCanvasWrapper.style.transform = `scale(1)`;
      followingCanvasWrapper.classList.toggle("pointer-events-none");
      followingCanvasWrapper.classList.toggle("origin-top-left");
      followingCanvasWrapper.classList.toggle("transition-[transform]");
      followingStopped = true;
      followingCanvas.isDrawingMode = true;

      if (this.followingRect) return;

      const pointer = canvas.getPointer(opt.e);

      this.followingRect = new fabric.Rect({
        width: canvasSize,
        height: canvasSize,
        top: pointer.y - canvasSize / 2,
        left: pointer.x - canvasSize / 2,
        fill: "transparent",
        selectable: false,
      });

      canvas.add(this.followingRect.bringToFront());
      this.lockPanAndZoom = true;
    });

    let canvasSize = 512;
    let followingStopped = false;

    this.followingCanvas = new fabric.Canvas("following-canvas");
    const followingCanvas = this.followingCanvas;

    followingCanvas.setWidth(canvasSize);
    followingCanvas.setHeight(canvasSize);
    followingCanvas.freeDrawingBrush.width = 10;
    followingCanvas.freeDrawingBrush.limitToCanvasSize = true;
    followingCanvas.getElement().parentElement.style.position = "absolute";

    followingCanvas.on("path:created", () => {
      this.pushEvent("can_accept_drawing", {});
    });

    canvas.on("mouse:wheel", (opt) => {
      if (this.lockPanAndZoom) return;

      const deltaY = opt.e.deltaY;
      let zoom = canvas.getZoom();

      zoom *= 0.999 ** deltaY;

      if (zoom > 1) zoom = 1;
      if (zoom < 0.2) zoom = 0.2;

      canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);

      const followingCanvasWrapper = document.getElementById(
        "following-canvas-wrapper"
      );

      if (this.followingRect) {
        const { tl } = this.followingRect.lineCoords;

        followingCanvasWrapper.style.top = `${tl.y}px`;
        followingCanvasWrapper.style.left = `${tl.x}px`;
      }

      followingCanvasWrapper.style.transform = `scale(${zoom})`;

      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    window.addEventListener("mousemove", setFollowingCanvasPosition.bind(this));
    window.addEventListener("keydown", enableDrag.bind(this));
    window.addEventListener("keyup", enableDrag.bind(this));
    window.addEventListener("resize", setCanvasSize.bind(this));

    function setCanvasSize() {
      const canvasWrapper = document.getElementById("canvas-wrapper");
      const canvasWrapperWidth = canvasWrapper.offsetWidth;
      const canvasWrapperHeight = canvasWrapper.offsetHeight;

      this.canvas.setDimensions({
        width: canvasWrapperWidth,
        height: canvasWrapperHeight,
      });
    }

    function setFollowingCanvasPosition(event) {
      if (this.followingCanvas.isDrawingMode || this.lockPanAndZoom) return;

      const { clientX, clientY } = event;
      const x = clientX - canvasSize / 2;
      const y = clientY - canvasSize / 2;

      const followingCanvasWrapper = document.getElementById(
        "following-canvas-wrapper"
      );

      followingCanvasWrapper.style.left = `${x}px`;
      followingCanvasWrapper.style.top = `${y}px`;
    }

    function enableDrag(event) {
      if (event.code !== "Space" && event.key !== " ") return;

      const keyDown = event.type === "keydown" ? true : false;
      const followingCanvasWrapper = document.getElementById(
        "following-canvas-wrapper"
      );

      if (keyDown) {
        followingCanvasWrapper.style.transform = `scale(0)`;
      } else {
        followingCanvasWrapper.style.transform = `scale(${canvas.getZoom()})`;
      }

      this.canDrag = keyDown;
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
      ...this.maskCoords,
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
          this.lockPanAndZoom = false;
          this.followingCanvas.clear();
        });
      })
      .catch((err) => console.error(err));
  },
  handleSelectedColor({ color }) {
    this.followingCanvas.freeDrawingBrush.color = color;
  },
  handleSelectedBackgroundColor({ color }) {
    this.currentBackgroundColor = color;
    const followingCanvasWrapper = document.getElementById(
      "following-canvas-wrapper"
    );

    followingCanvasWrapper.style.borderColor = color;
  },
  handleAcceptedDrawing() {
    const canvas = this.canvas;
    const followingCanvas = this.followingCanvas;
    canvas.remove(this.followingRect);
    this.followingRect = null;
    this.lockPanAndZoom = true;

    const dataURL = followingCanvas.toDataURL();

    followingCanvas.setBackgroundColor(this.currentBackgroundColor);
    const canvasEl = followingCanvas.getElement();
    const coords = canvasEl.parentElement.getBoundingClientRect();
    const canvasCoords = canvas.calcViewportBoundaries();

    const originalDrawing = followingCanvas.toDataURL();

    this.pushEvent("send_drawing", {
      drawing: originalDrawing,
      coords: {
        top: Math.floor(coords.top + canvasCoords.tl.y),
        left: Math.floor(coords.left + canvasCoords.tl.x),
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

      this.maskCoords = {
        top: background.lineCoords.tl.y,
        left: background.lineCoords.tl.x,
      };

      intersectingObjects.forEach((obj) => {
        const { bl, tl, br, tr } = obj.lineCoords;

        const isTopLeftInside = oImg.containsPoint(tl);
        const isTopRightInside = oImg.containsPoint(tr);
        const isBottomLeftInside = oImg.containsPoint(bl);
        const isBottomRightInside = oImg.containsPoint(br);

        const bottomLeftInside = {
          top: oImg.lineCoords.tr.y + canvasCoords.tl.y,
          left:
            oImg.lineCoords.tr.x -
            Math.abs(oImg.lineCoords.tr.x - bl.x) +
            canvasCoords.tl.x,
          width: Math.abs(oImg.lineCoords.tr.x - bl.x),
          height: Math.abs(oImg.lineCoords.tr.y - bl.y),
        };

        const bottomRightInside = {
          top: oImg.lineCoords.tl.y + canvasCoords.tl.y,
          left: oImg.lineCoords.tl.x + canvasCoords.tl.x,
          width: Math.abs(oImg.lineCoords.tl.x - br.x),
          height: Math.abs(oImg.lineCoords.tl.y - br.y),
        };

        const topLeftInside = {
          top:
            oImg.lineCoords.br.y -
            Math.abs(oImg.lineCoords.br.y - tl.y) +
            canvasCoords.tl.y,
          left:
            oImg.lineCoords.br.x -
            Math.abs(oImg.lineCoords.br.x - tl.x) +
            canvasCoords.tl.x,
          width: Math.abs(oImg.lineCoords.br.x - tl.x),
          height: Math.abs(oImg.lineCoords.br.y - tl.y),
        };

        const topRightInside = {
          top:
            oImg.lineCoords.bl.y -
            Math.abs(oImg.lineCoords.bl.y - tr.y) +
            canvasCoords.tl.y,
          left: oImg.lineCoords.bl.x + canvasCoords.tl.x,
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
        ...this.maskCoords,
      });

      this.currentMask = mask;

      canvas.remove(mask);
      canvas.remove(background);
      const rectangles = canvas.getObjects("rect");
      canvas.remove(...rectangles);
      canvas.remove(oImg);
    });

    followingCanvas.isDrawingMode = false;

    const followingCanvasWrapper = document.getElementById(
      "following-canvas-wrapper"
    );
    followingCanvasWrapper.classList.toggle("pointer-events-none");
    followingCanvasWrapper.classList.remove("origin-top-left");
    followingCanvasWrapper.classList.toggle("transition-[transform]");
  },
  updated() {
    if (this.followingCanvas.isDrawingMode) {
      const followingCanvasWrapper = document.getElementById(
        "following-canvas-wrapper"
      );
      followingCanvasWrapper.classList.remove("pointer-events-none");
      followingCanvasWrapper.classList.add("origin-top-left");
      followingCanvasWrapper.classList.remove("transition-[transform]");
    }
  },
};

// get an area with one color from image
