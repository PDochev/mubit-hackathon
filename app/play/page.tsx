import type { Metadata } from "next";
import { Pixelify_Sans, VT323 } from "next/font/google";
import { NightShift } from "./night-shift";
import "./play.css";

const pixel = Pixelify_Sans({ subsets: ["latin"], variable: "--font-pixel" });
const type = VT323({ weight: "400", subsets: ["latin"], variable: "--font-type" });

export const metadata: Metadata = {
  title: "Night Shift · Precedent",
  description: "Train your AI apprentice before the morning audit.",
};

export default function Page() {
  return (
    <div className="h-dvh w-full overflow-hidden bg-[#05060f]">
      <NightShift pixelFont={pixel.className} typeFont={type.className} />
    </div>
  );
}
