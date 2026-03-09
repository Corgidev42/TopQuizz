import { QRCodeSVG } from "qrcode.react";

interface Props {
  url: string;
  gameId: string;
}

export default function QRCodeDisplay({ url, gameId }: Props) {
  if (!url) return null;

  return (
    <div className="card text-center animate-fade-in">
      <div className="bg-white p-4 rounded-xl inline-block mb-4">
        <QRCodeSVG value={url} size={220} level="M" />
      </div>
      <p className="text-neutral-400 text-sm mb-2">Scanne pour rejoindre</p>
      <div className="text-5xl font-black text-brand-orange tracking-widest">
        {gameId}
      </div>
      <p className="text-neutral-500 text-xs mt-2 break-all">{url}</p>
    </div>
  );
}
