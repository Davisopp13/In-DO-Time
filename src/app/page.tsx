import Image from "next/image";
import ActiveTimers from "@/components/ActiveTimers";

export default function Home() {
  return (
    <div className="flex flex-col gap-8">
      {/* Active running timers - auto-detected on load */}
      <ActiveTimers />

      {/* Placeholder for remaining dashboard content */}
      <div className="flex flex-col items-center justify-center py-16">
        <Image
          src="/DO_CODE_LAB_LOGO_NO_TEXT.png"
          alt="DO Code Lab Logo"
          width={120}
          height={120}
          className="mb-8 opacity-30"
        />
        <h1 className="mb-4 text-3xl font-semibold text-primary">
          Welcome to In DO Time
        </h1>
        <p className="text-text-muted">
          Your multi-client time tracking dashboard is coming soon.
        </p>
      </div>
    </div>
  );
}
