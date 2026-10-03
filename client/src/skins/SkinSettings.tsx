import { useSkins } from "./SkinContext";
import { BOARD_THEMES, CHESS_SETS, SHOGI_STYLES } from "./skins";
import "./SkinSettings.css";

export function SkinSettings({ onClose }: { onClose: () => void }) {
  const { skins, setSkin } = useSkins();
  return (
    <div className="skins-overlay" onClick={onClose}>
      <div className="skins" onClick={(e) => e.stopPropagation()}>
        <div className="skins__head">
          <span>外观皮肤</span>
          <button className="skins__x" onClick={onClose}>×</button>
        </div>

        <section className="skins__sec">
          <h4 className="skins__h">棋盘风格</h4>
          <div className="skins__row">
            {BOARD_THEMES.map((t) => (
              <button key={t.id} className={`skins__opt${skins.board === t.id ? " skins__opt--on" : ""}`} onClick={() => setSkin({ board: t.id })}>
                <span className="skins__board" style={{ borderColor: t.border }}>
                  <i style={{ background: t.woodDark }} /><i style={{ background: t.woodLight }} />
                  <i style={{ background: t.river }} /><i style={{ background: t.river }} />
                  <i style={{ background: t.chessLight }} /><i style={{ background: t.chessDark }} />
                </span>
                <span className="skins__name">{t.name}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="skins__sec">
          <h4 className="skins__h">国象棋子</h4>
          <div className="skins__row">
            {CHESS_SETS.map((s) => (
              <button key={s.id} className={`skins__opt${skins.chessSet === s.id ? " skins__opt--on" : ""}`} onClick={() => setSkin({ chessSet: s.id })}>
                <img className="skins__chess" src={`${import.meta.env.BASE_URL}pieces/${s.id}/wN.svg`} alt="" />
                <span className="skins__name">{s.name}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="skins__sec">
          <h4 className="skins__h">将棋棋子</h4>
          <div className="skins__row">
            {SHOGI_STYLES.map((s) => (
              <button key={s.id} className={`skins__opt${skins.shogiStyle === s.id ? " skins__opt--on" : ""}`} onClick={() => setSkin({ shogiStyle: s.id })}>
                <span className="skins__koma" style={{ background: s.bg, color: s.text }}>玉</span>
                <span className="skins__name">{s.name}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
