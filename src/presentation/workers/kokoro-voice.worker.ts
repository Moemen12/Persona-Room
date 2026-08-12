import { KokoroTTS } from "kokoro-js";

type CompanionVoice = "rina" | "joon";
type WorkerRequest =
  | { type: "prepare"; requestId: number }
  | { type: "synthesize"; requestId: number; text: string; companionId: CompanionVoice };
type WorkerResponse =
  | { type: "status"; requestId: number; status: "loading" | "ready"; progress?: number }
  | { type: "audio"; requestId: number; audioBuffer: ArrayBuffer }
  | { type: "error"; requestId: number; message: string };

type KokoroModel = Awaited<ReturnType<typeof KokoroTTS.from_pretrained>>;

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: WorkerResponse, transfer?: Transferable[]) => void;
};

let modelPromise: Promise<KokoroModel> | null = null;

function postMessage(message: WorkerResponse, transfer?: Transferable[]) {
  workerScope.postMessage(message, transfer);
}

function localModelOptions() {
  const hasWebGpu = typeof navigator !== "undefined" && "gpu" in navigator;
  return {
    dtype: hasWebGpu ? "fp32" : "q8",
    device: hasWebGpu ? "webgpu" : "wasm",
  } as const;
}

function loadModel(requestId: number) {
  if (modelPromise) return modelPromise;

  postMessage({ type: "status", requestId, status: "loading", progress: 0 });
  modelPromise = KokoroTTS.from_pretrained(
    "onnx-community/Kokoro-82M-v1.0-ONNX",
    {
      ...localModelOptions(),
      progress_callback: (progress) => {
        const progressValue =
          "progress" in progress && typeof progress.progress === "number"
            ? progress.progress
            : undefined;
        postMessage({
          type: "status",
          requestId,
          status: "loading",
          progress: progressValue,
        });
      },
    },
  );

  return modelPromise;
}

workerScope.onmessage = (event) => {
  const request = event.data;

  void (async () => {
    try {
      const model = await loadModel(request.requestId);
      postMessage({ type: "status", requestId: request.requestId, status: "ready", progress: 100 });

      if (request.type === "prepare") return;

      const audio = await model.generate(request.text, {
        voice: request.companionId === "rina" ? "af_bella" : "am_michael",
        speed: request.companionId === "rina" ? 1.03 : 0.97,
      });
      const audioBuffer = audio.toWav();
      postMessage({ type: "audio", requestId: request.requestId, audioBuffer }, [audioBuffer]);
    } catch (error) {
      if (request.type === "prepare") modelPromise = null;
      postMessage({
        type: "error",
        requestId: request.requestId,
        message: error instanceof Error ? error.message : "Local neural voice failed.",
      });
    }
  })();
};
