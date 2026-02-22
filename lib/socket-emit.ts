declare global {
  var io: { to: (room: string) => { emit: (event: string, data: unknown) => void } } | undefined;
}

export function emitToSpace(spaceId: string, event: string, data: unknown) {
  try {
    if (typeof (globalThis as any).io !== 'undefined') {
      (globalThis as any).io.to(`space:${spaceId}`).emit(event, data);
    }
  } catch {}
}
