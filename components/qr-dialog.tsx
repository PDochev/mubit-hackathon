import { QrCode } from "lucide-react";
import { connection } from "next/server";
import QRCode from "qrcode";
import { MonoLabel } from "@/components/app-ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { publicUrl } from "@/lib/lan";

// The submit form's address as a QR code, for the audience to scan.
export async function submitQr(width: number) {
  const url = `${publicUrl()}/submit`;
  const src = await QRCode.toDataURL(url, {
    margin: 1,
    width,
    color: { dark: "#09090b", light: "#ffffff" },
  });
  return { url, src };
}

export async function QrDialog() {
  await connection();
  const { url, src } = await submitQr(480);

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>
        <QrCode data-icon="inline-start" />
        Show QR
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Submit an expense from your phone</DialogTitle>
          <DialogDescription>
            Scan to open the form. Finance sees it in the inbox seconds later.
          </DialogDescription>
        </DialogHeader>
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL QR code */}
        <img
          src={src}
          alt={`QR code for ${url}`}
          width={480}
          height={480}
          className="w-full rounded-xl p-2 ring-1 ring-border"
        />
        <MonoLabel className="text-center">{url}</MonoLabel>
      </DialogContent>
    </Dialog>
  );
}
