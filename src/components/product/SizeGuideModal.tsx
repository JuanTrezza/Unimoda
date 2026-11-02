import { SIZE_GUIDE } from '../../data/products'
import { Modal } from '../ui/Modal'

export function SizeGuideModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Guía de talles">
      <p className="text-sm text-tinta-soft">
        Medidas del cuerpo en centímetros. Si estás entre dos talles, te recomendamos elegir el más grande.
      </p>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Equivalencia de talles según busto, cintura y cadera</caption>
          <thead>
            <tr className="border-b border-tinta/15">
              <th scope="col" className="py-3 pr-4 font-medium">
                Talle
              </th>
              <th scope="col" className="py-3 pr-4 font-medium">
                Busto
              </th>
              <th scope="col" className="py-3 pr-4 font-medium">
                Cintura
              </th>
              <th scope="col" className="py-3 font-medium">
                Cadera
              </th>
            </tr>
          </thead>
          <tbody>
            {SIZE_GUIDE.map((row) => (
              <tr key={row.size} className="border-b border-tinta/10">
                <th scope="row" className="py-3 pr-4 font-medium">
                  {row.size}
                </th>
                <td className="py-3 pr-4 tabular-nums">{row.busto}</td>
                <td className="py-3 pr-4 tabular-nums">{row.cintura}</td>
                <td className="py-3 tabular-nums">{row.cadera}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 className="mt-6 font-serif text-lg">Cómo medirte</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-tinta-soft">
        <li>Busto: alrededor de la parte más prominente.</li>
        <li>Cintura: en la parte más angosta del torso.</li>
        <li>Cadera: en la parte más ancha, con los pies juntos.</li>
      </ul>
    </Modal>
  )
}
