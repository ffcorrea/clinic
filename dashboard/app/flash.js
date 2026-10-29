// Mensagem de sucesso/erro vinda de uma acao (?ok=... / ?erro=...)
export default function Flash({ params }) {
  if (params?.erro) return <div className="alert error">{params.erro}</div>;
  if (params?.ok) return <div className="alert ok">{params.ok}</div>;
  return null;
}
