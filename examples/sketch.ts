import { drawCircle, drawRect } from "@daeinc/draw";
import { ssam } from "ssam";
import type { Sketch, SketchProps, SketchSettings } from "ssam";
import { css, hsv } from "@thi.ng/color";

export type Payload = {
  dryRun: boolean;
  version: string;
  input: {
    prompt: string;
    seed?: number;
    [key: string]: any;
  };
};

// "lucataco/realvisxl2-lcm:479633443fc6588e1e8ae764b79cdb3702d0c196e0cb2de6db39ce577383be77";
const version =
  "479633443fc6588e1e8ae764b79cdb3702d0c196e0cb2de6db39ce577383be77";

const sketch = ({
  wrap,
  canvas,
  context: ctx,
  width,
  height,
  render,
}: SketchProps) => {
  let output: HTMLImageElement[] = [];

  if (import.meta.hot) {
    import.meta.hot.on("ssam:replicate-prediction", async (prediction) => {
      console.log(prediction);
      output = await Promise.all(
        prediction.output.map(async (url: string) => await loadImage(url)),
      );
      console.log(output);
      render();
    });
  }

  const runModel = (ev: KeyboardEvent) => {
    if (!(ev.metaKey || ev.ctrlKey || ev.shiftKey) && ev.key === "g") {
      const payload: Payload = {
        dryRun: false,
        version,
        input: {
          prompt: "An astronaut in spacesuit on Mars",
          negative_prompt: "",
          image: canvas.toDataURL(),
          width,
          height,
          num_outputs: 1,
          num_inference_steps: 6,
          guidance_scale: 2,
          prompt_strength: 0.8,
          seed: (Math.random() * 100000000) | 0,
        },
      };
      import.meta.hot &&
        import.meta.hot.send("ssam:replicate-predict", payload);
    }
  };
  window.addEventListener("keydown", runModel);

  wrap.render = ({ width, height }: SketchProps) => {
    ctx.fillStyle = css(hsv([0.65, 0.9, 0.1]));
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = css(hsv([0.02, 0.9, 0.6]));
    ctx.fillRect(0, (height / 3) * 2, width, height);

    drawCircle(ctx, [width / 2, height / 4], 400);
    ctx.fillStyle = `#aaa`;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(width / 2, height / 4, 150, 120, 0, 0, Math.PI * 2);
    ctx.fillStyle = `#f16`;
    ctx.fill();

    drawRect(ctx, [width / 2, (height / 5) * 3], [200, 300], "center");
    ctx.fillStyle = `#aaa`;
    ctx.fill();
    drawRect(ctx, [width / 2 - 50, (height / 7) * 6], [60, 250], "center");
    ctx.fillStyle = `#aaa`;
    ctx.fill();
    drawRect(ctx, [width / 2 + 50, (height / 7) * 6], [60, 250], "center");
    ctx.fillStyle = `#aaa`;
    ctx.fill();

    if (output[0]) {
      ctx.drawImage(output[0], 0, 0, width, height);
    }
  };

  wrap.unload = () => {
    window.removeEventListener("keydown", runModel);
  };
};

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.crossOrigin = "anonymous";
    img.src = src;
  });

const settings: SketchSettings = {
  mode: "2d",
  dimensions: [1024, 1024],
  animate: false,
  framesFormat: ["mp4-browser"],
};

ssam(sketch as Sketch, settings);
