"use client";

import { PageHeader } from "@/components/PageHeader";
import { usePopup } from "@/components/CenterPopup";
import { adminApiRequest } from "@/lib/adminApiClient";
import type { Detection, FaceDetection } from "@mediapipe/face_detection";
import type { TFLiteModel } from "@tensorflow/tfjs-tflite";
import { averageEmbeddings, type FaceAttendanceSettings } from "@sri-narayana/shared";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Loader2,
  ScanFace,
  ShieldCheck,
  X
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type TeacherRow = {
  id: string;
  fullName: string;
  employeeId: string;
  subject: string;
  enrolled: boolean;
  face: { modelVersion: string; sampleCount: number; quality?: number; updatedAt: string } | null;
};

type AdminResponse = {
  ok: boolean;
  settings: FaceAttendanceSettings;
  teachers: TeacherRow[];
};

type Angle = "center" | "left" | "right";

type Sample = {
  angle: Angle;
  label: string;
  embedding: number[];
  quality: number;
};

const ANGLES: { angle: Angle; label: string; instruction: string }[] = [
  { angle: "center", label: "Look straight", instruction: "Face the camera and look straight ahead." },
  { angle: "left", label: "Turn slightly left", instruction: "Turn your head a little to your left." },
  { angle: "right", label: "Turn slightly right", instruction: "Turn your head a little to your right." }
];

export default function EnrollFaceClient() {
  const searchParams = useSearchParams();
  const toast = usePopup();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<FaceDetection | null>(null);
  const modelRef = useRef<TFLiteModel | null>(null);
  const tfRef = useRef<typeof import("@tensorflow/tfjs-core") | null>(null);
  const faceRef = useRef<Detection | null>(null);

  const [settings, setSettings] = useState<FaceAttendanceSettings | null>(null);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [teacherId, setTeacherId] = useState(searchParams.get("teacherId") ?? "");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modelStatus, setModelStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [cameraOn, setCameraOn] = useState(false);
  const [starting, setStarting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedTeacher = teachers.find((teacher) => teacher.id === teacherId) ?? null;
  const complete = samples.length === ANGLES.length;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await adminApiRequest<AdminResponse>("/api/admin/face-attendance", undefined, { fresh: true });
      setSettings(result.settings);
      setTeachers(result.teachers ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load teachers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      void detectorRef.current?.close().catch(() => {});
    };
  }, []);

  const ensureModel = async () => {
    if (modelRef.current && tfRef.current) return;
    setModelStatus("loading");
    setMessage("Loading the face model. The first load may take a few seconds.");
    try {
      const tf = await import("@tensorflow/tfjs-core");
      await import("@tensorflow/tfjs-backend-cpu");
      const tflite = await import("@tensorflow/tfjs-tflite/dist/tf-tflite.fesm.js");
      tflite.setWasmPath("/models/");
      await tf.setBackend("cpu");
      await tf.ready();
      modelRef.current = await tflite.loadTFLiteModel("/models/mobilefacenet.tflite");
      tfRef.current = tf;
      setModelStatus("ready");
      setMessage("Face model ready.");
    } catch (err) {
      setModelStatus("error");
      throw new Error(
        err instanceof Error
          ? `Face model failed to load: ${err.message}`
          : "Face model failed to load. Check the browser console."
      );
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
    faceRef.current = null;
  };

  const startCamera = async () => {
    if (starting || cameraOn) return;
    if (!settings?.enabled) {
      setError("Turn on face attendance before enrolling teachers.");
      return;
    }
    if (!teacherId) {
      setError("Choose a teacher first.");
      return;
    }
    setStarting(true);
    setError(null);
    setMessage("Starting camera...");
    try {
      await ensureModel();
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("This browser cannot open the camera. Use Chrome or Edge on the office laptop.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const { FaceDetection: FaceDetector } = await import("@mediapipe/face_detection");
      const detector = new FaceDetector({
        locateFile: (file) => `/mediapipe/face_detection/${file}`
      });
      detector.setOptions({
        model: "short",
        selfieMode: false,
        minDetectionConfidence: 0.6
      });
      detector.onResults((results) => {
        faceRef.current = results.detections[0] ?? null;
      });
      await detector.initialize();
      detectorRef.current = detector;
      setCameraOn(true);
      setMessage("Camera ready. Hold still and capture the first angle.");
    } catch (err) {
      stopCamera();
      setError(err instanceof Error ? err.message : "Could not start the camera.");
      setMessage(null);
    } finally {
      setStarting(false);
    }
  };

  const capture = async (angle: Angle, label: string) => {
    if (capturing) return;
    const video = videoRef.current;
    const detector = detectorRef.current;
    const model = modelRef.current;
    const tf = tfRef.current;
    if (!video || !detector || !model || !tf) {
      setError("Start the camera first.");
      return;
    }
    setCapturing(true);
    setError(null);
    setMessage(`Capturing ${label.toLowerCase()}...`);
    try {
      await detector.send({ image: video });
      await new Promise((resolve) => window.setTimeout(resolve, 120));
      const detection = faceRef.current;
      if (!detection) {
        throw new Error("No face detected. Move closer, face the camera, and use good light.");
      }

      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;
      if (!videoWidth || !videoHeight) throw new Error("The camera is not ready yet.");

      const box = detection.boundingBox;
      const centerX = box.xCenter * videoWidth;
      const centerY = box.yCenter * videoHeight;
      const boxWidth = box.width * videoWidth;
      const boxHeight = box.height * videoHeight;
      let side = Math.max(boxWidth, boxHeight) * 1.35;
      side = Math.max(112, Math.min(side, Math.min(videoWidth, videoHeight)));
      const sx = Math.max(0, Math.min(videoWidth - side, centerX - side / 2));
      const sy = Math.max(0, Math.min(videoHeight - side, centerY - side / 2));

      const canvas = document.createElement("canvas");
      canvas.width = 112;
      canvas.height = 112;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not prepare the camera image.");
      context.drawImage(video, sx, sy, side, side, 0, 0, 112, 112);

      const embedding = tf.tidy(() => {
        const pixels = tf.cast(tf.browser.fromPixels(canvas), "float32");
        const input = tf.sub(tf.div(tf.expandDims(pixels, 0), 127.5), 1);
        const output = model.predict(input) as import("@tensorflow/tfjs-core").Tensor;
        return Array.from(output.dataSync());
      });

      if (embedding.length < 64) throw new Error("The face model returned an invalid result.");
      const quality = Math.max(0, Math.min(1, (side / Math.min(videoWidth, videoHeight)) * 1.8));

      setSamples((current) =>
        [...current.filter((sample) => sample.angle !== angle), { angle, label, embedding, quality }].sort(
          (left, right) => ANGLES.findIndex((item) => item.angle === left.angle) - ANGLES.findIndex((item) => item.angle === right.angle)
        )
      );
      setMessage(`${label} captured.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not capture this angle.");
      setMessage(null);
    } finally {
      setCapturing(false);
    }
  };

  const save = async () => {
    if (!settings || !selectedTeacher || samples.length !== ANGLES.length) return;
    setSaving(true);
    setError(null);
    try {
      const embedding = averageEmbeddings(samples.map((sample) => sample.embedding));
      if (!embedding.length) throw new Error("The captured samples could not be combined. Please retake them.");
      const quality = samples.reduce((total, sample) => total + sample.quality, 0) / samples.length;
      await adminApiRequest("/api/admin/face-attendance/enroll", {
        method: "POST",
        body: JSON.stringify({
          teacherId: selectedTeacher.id,
          embedding,
          modelVersion: settings.modelVersion,
          sampleCount: samples.length,
          quality
        })
      });
      toast.success("Face enrolled", `${selectedTeacher.fullName} can now use face attendance.`);
      setSamples([]);
      setMessage("Enrollment saved. Only the face fingerprint was stored; no photo was uploaded.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the face enrollment.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 className="animate-spin text-[#3033a1]" size={28} />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Enroll teacher face"
        description="Use this office laptop's webcam. Capture three angles; only the face fingerprint is saved, not the photo."
        action={
          <Link className="btn-secondary" href="/admin/face-attendance">
            <ArrowLeft size={16} /> Back to face attendance
          </Link>
        }
      />
      <section className="space-y-5 p-4 md:p-7">
        {loadError && (
          <p className="rounded-xl border border-[#ffd5da] bg-[#ffebed] px-3 py-2 text-sm font-semibold text-[#c83f4d]">
            {loadError}
          </p>
        )}

        {settings && !settings.enabled && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#ffe1a8] bg-[#fff8e8] px-4 py-3 text-sm">
            <span className="flex items-center gap-2 font-semibold text-[#8a5a00]">
              <AlertTriangle size={18} /> Face attendance is currently off, so enrollment is blocked.
            </span>
            <Link className="btn-secondary" href="/admin/face-attendance">
              Turn it on
            </Link>
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-[#ffd5da] bg-[#ffebed] px-3 py-2 text-sm font-semibold text-[#c83f4d]">
            {error}
          </p>
        )}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-4 py-3">
              <div>
                <h2 className="font-bold text-[#1f2136]">Office laptop camera</h2>
                <p className="text-sm font-medium text-[#7d86a8]">
                  Chrome or Edge works best. The camera is only used on this page.
                </p>
              </div>
              {cameraOn ? (
                <button className="btn-secondary" onClick={stopCamera}>
                  <X size={16} /> Stop camera
                </button>
              ) : (
                <button
                  className="btn-primary"
                  disabled={starting || !settings?.enabled || !teacherId}
                  onClick={() => void startCamera()}
                >
                  {starting ? <Loader2 className="animate-spin" size={16} /> : <Camera size={16} />}
                  {starting ? "Starting..." : "Start camera"}
                </button>
              )}
            </div>

            <div className="relative aspect-video bg-[#111322]">
              <video
                ref={videoRef}
                className={`h-full w-full object-cover ${cameraOn ? "scale-x-[-1]" : "opacity-0"}`}
                muted
                playsInline
              />
              {cameraOn ? (
                <>
                  <div className="pointer-events-none absolute inset-0 grid place-items-center">
                    <div className="h-[62%] w-[38%] rounded-[48%] border-2 border-dashed border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.18)]" />
                  </div>
                  <p className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white">
                    Keep one face inside the oval
                  </p>
                </>
              ) : (
                <div className="absolute inset-0 grid place-items-center p-6 text-center">
                  <div>
                    <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/10 text-white/80">
                      <ScanFace size={28} />
                    </span>
                    <p className="mt-3 text-sm font-semibold text-white/80">
                      Choose a teacher, then start the camera.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="card space-y-4 p-4">
              <label className="block text-sm font-bold text-[#303247]">
                Teacher
                <select
                  className="field mt-2"
                  value={teacherId}
                  disabled={cameraOn || saving}
                  onChange={(event) => {
                    setTeacherId(event.target.value);
                    setSamples([]);
                    setMessage(null);
                    setError(null);
                  }}
                >
                  <option value="">Choose a teacher</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.fullName} {teacher.employeeId ? `(${teacher.employeeId})` : ""}
                    </option>
                  ))}
                </select>
              </label>

              {selectedTeacher && (
                <div className="rounded-xl border border-[#e3e6f0] bg-[#f8f9ff] px-3 py-2 text-sm">
                  <p className="font-bold text-[#303247]">{selectedTeacher.fullName}</p>
                  <p className="font-medium text-[#7d86a8]">
                    {selectedTeacher.enrolled
                      ? "Already enrolled. Capturing again will replace the old face."
                      : "Not enrolled yet."}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2 text-xs font-semibold text-[#7d86a8]">
                <ShieldCheck size={16} className="text-[#0f8d52]" />
                {modelStatus === "ready"
                  ? "Face model ready (MobileFaceNet 192)."
                  : modelStatus === "loading"
                    ? "Loading face model..."
                    : modelStatus === "error"
                      ? "Face model failed to load."
                      : "The model loads when you start the camera."}
              </div>
            </div>

            <div className="card space-y-3 p-4">
              <h2 className="font-bold text-[#1f2136]">Capture 3 angles</h2>
              {ANGLES.map((item) => {
                const sample = samples.find((entry) => entry.angle === item.angle);
                return (
                  <div
                    key={item.angle}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#e3e6f0] px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-bold text-[#303247]">{item.label}</p>
                      <p className="text-xs font-medium text-[#7d86a8]">{item.instruction}</p>
                    </div>
                    {sample ? (
                      <span className="inline-flex items-center gap-1 text-sm font-bold text-[#0f8d52]">
                        <CheckCircle2 size={16} /> Done
                      </span>
                    ) : (
                      <button
                        className="btn-secondary shrink-0"
                        disabled={!cameraOn || capturing || saving}
                        onClick={() => void capture(item.angle, item.label)}
                      >
                        <Camera size={15} /> Capture
                      </button>
                    )}
                  </div>
                );
              })}

              {message && <p className="text-sm font-medium text-[#4b506d]">{message}</p>}

              <button className="btn-primary w-full" disabled={!complete || saving} onClick={() => void save()}>
                {saving ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
                {saving ? "Saving..." : complete ? "Save face enrollment" : `Capture ${ANGLES.length - samples.length} more angle(s)`}
              </button>
              <p className="text-xs font-medium text-[#7d86a8]">
                The photo never leaves this laptop. The server stores a 192-number face fingerprint used for matching.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
