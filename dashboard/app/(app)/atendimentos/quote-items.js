import { KIND_LABEL, formatBRL, itemTotal, itemsTotal } from '../../../lib/format';

/**
 * Tabelas de tratamentos e materiais com subtotais; esconde a tabela vazia quando a outra tem itens.
 * selection: { selectable: Set, marked: Set, toggle(id) }; columns: [{ title, cell(item) }]
 */
export default function QuoteItems({ items, totalLabel = 'Total', selection, columns = [] }) {
  const groups = Object.keys(KIND_LABEL).map((kind) => [kind, items.filter((i) => i.kind === kind)]);
  const anyItem = items.length > 0;

  return (
    <div className="quote-items">
      {groups
        .filter(([, list]) => list.length > 0 || (!anyItem && list === groups[0][1]))
        .map(([kind, list]) => (
          <div key={kind}>
            <h3>{KIND_LABEL[kind]}</h3>
            {list.length === 0 ? (
              <p className="muted">Nenhum item.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {selection && <th aria-label="Enviar" />}
                      <th>Descrição</th>
                      <th className="num">Qtd</th>
                      <th className="num col-unit">Unitário</th>
                      <th className="num">Total</th>
                      {columns.map((c) => (
                        <th key={c.title}>{c.title}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((i) => {
                      const selectable = selection?.selectable.has(i.id);
                      return (
                        <tr key={i.id} className={selectable && !selection.marked.has(i.id) ? 'inactive' : ''}>
                          {selection && (
                            <td>
                              {selectable && <input type="checkbox" aria-label={`Enviar ${i.description}`} checked={selection.marked.has(i.id)} onChange={() => selection.toggle(i.id)} />}
                            </td>
                          )}
                          <td className="wrap">{i.description}</td>
                          <td className="num">{i.quantity.toLocaleString('pt-BR')}</td>
                          <td className="num col-unit">{formatBRL(i.unit_cents)}</td>
                          <td className="num">{formatBRL(itemTotal(i))}</td>
                          {columns.map((c) => (
                            <td key={c.title}>{c.cell(i)}</td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      <div className="quote-total">
        <span>{totalLabel}</span>
        <strong>{formatBRL(itemsTotal(items))}</strong>
      </div>
    </div>
  );
}
