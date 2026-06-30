export default function OfflinePage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Sin conexión</h1>
      <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
        Whalabi necesita conexión para sincronizar con Matrix. El shell de la app está
        disponible offline; reconéctate para ver tus mensajes.
      </p>
    </div>
  );
}
