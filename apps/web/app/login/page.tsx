import { LoginClientLoader } from "./LoginClientLoader";

export const metadata = {
  title: "Login | SNHS School Software – Sri Narayana High School",
  description:
    "Login to SNHS School Software (NarayanaOS) – staff attendance, fee collection, exams, salary, and parent portal for Sri Narayana High School."
};

export default function LoginPage() {
  return (
    <>
      <h1 className="sr-only">SNHS School Software – Sri Narayana High School login</h1>
      <p className="sr-only">
        SNHS school management software for attendance, fee collection, finance, exams, salary, and parent portal.
      </p>
      <LoginClientLoader />
    </>
  );
}
