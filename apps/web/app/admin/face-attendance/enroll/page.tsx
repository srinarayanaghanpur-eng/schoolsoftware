import { Suspense } from "react";
import EnrollFaceClient from "./EnrollFaceClient";

export default function EnrollFacePage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-[40vh] place-items-center text-sm font-semibold text-[#7d86a8]">
          Loading face enrollment...
        </div>
      }
    >
      <EnrollFaceClient />
    </Suspense>
  );
}
