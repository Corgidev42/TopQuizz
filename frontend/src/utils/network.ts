function isPrivateIPv4(ip: string): boolean {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return false;
  const [a, b] = ip.split(".").map((x) => parseInt(x, 10));
  if ([a, b].some((n) => Number.isNaN(n))) return false;
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

function scoreHost(host: string): number {
  // Higher is better
  if (!host) return -10;
  if (host === "localhost" || host === "127.0.0.1") return -5;
  if (isPrivateIPv4(host)) return 10;
  return 1;
}

export function buildJoinUrl(host: string, gameId: string, port = 3000): string {
  const safeGameId = (gameId || "").toUpperCase();
  return `http://${host}:${port}/play?game=${encodeURIComponent(safeGameId)}`;
}

export async function detectLanHostCandidates(): Promise<string[]> {
  const candidates = new Set<string>();

  // 1) Use current hostname as a baseline
  if (window.location.hostname) candidates.add(window.location.hostname);

  // 2) Try WebRTC ICE candidates to discover LAN IPs (works on most browsers)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const RTCPeerConnectionCtor: any =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).RTCPeerConnection ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).webkitRTCPeerConnection ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).mozRTCPeerConnection;

    if (RTCPeerConnectionCtor) {
      const pc = new RTCPeerConnectionCtor({ iceServers: [] });
      pc.createDataChannel("x");

      const done = new Promise<void>((resolve) => {
        const timeout = setTimeout(() => resolve(), 1200);
        pc.onicecandidate = (evt: RTCPeerConnectionIceEvent) => {
          const cand = evt.candidate?.candidate ?? "";
          const m = cand.match(
            /candidate:\S+\s+\d+\s+\S+\s+\d+\s+(\d{1,3}(?:\.\d{1,3}){3})\s+\d+\s+typ\s+host/i
          );
          if (m?.[1] && isPrivateIPv4(m[1])) {
            candidates.add(m[1]);
          }
          if (!evt.candidate) {
            clearTimeout(timeout);
            resolve();
          }
        };
      });

      await pc.createOffer();
      await pc.setLocalDescription(await pc.createOffer());
      await done;
      pc.close();
    }
  } catch {
    // Best-effort only
  }

  return [...candidates].sort((a, b) => scoreHost(b) - scoreHost(a));
}

export async function pickBestJoinUrl(
  gameId: string,
  fallbackUrl?: string | null
): Promise<string | null> {
  const candidates = await detectLanHostCandidates();
  if (candidates.length > 0) {
    const best = candidates[0];
    // If we're already on LAN/IP, keep same host; otherwise prefer detected LAN IP
    return buildJoinUrl(best, gameId, 3000);
  }
  return fallbackUrl ?? null;
}

