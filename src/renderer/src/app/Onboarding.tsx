// Первая настройка за минуту: профиль, режим экрана игры, главные клавиши
import { useState } from 'react'
import { activeProfile, type Profile } from '../../../shared/settings'
import { api, useSettings, useStore } from '../common/store'
import { Emblem, Kbd } from '../common/ui'
import { ProfileFields } from './SettingsPage'

const STEPS = ['Профиль', 'Игра', 'Клавиши']

export function Onboarding() {
  const settings = useSettings()
  const game = useStore((s) => s.app!.game)
  const elevated = useStore((s) => s.app!.elevated)
  const patchSettings = useStore((s) => s.patchSettings)
  const [step, setStep] = useState(0)
  const [profile, setProfile] = useState<Profile>(() => activeProfile(settings))

  const finish = () =>
    patchSettings((s) => ({
      ...s,
      profiles: s.profiles.map((p) => (p.id === profile.id ? profile : p)),
      onboarded: true
    }))

  const binds = settings.binds.filter((b) => b.hotkey).slice(0, 10)
  const hk = settings.hotkeys

  return (
    <div className="modal-backdrop">
      <section className="modal" role="dialog" aria-label="Первая настройка">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Emblem size={46} />
          <div>
            <h2>ФСВНГ Helper</h2>
            <span className="hint">
              Первая настройка · шаг {step + 1} из {STEPS.length}: {STEPS[step]}
            </span>
          </div>
        </div>
        <div className="steps-dots" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span key={s} className={i <= step ? 'on' : ''} />
          ))}
        </div>

        {step === 0 && (
          <>
            <p style={{ margin: 0, color: 'var(--text-2)' }}>
              Эти данные подставляются в отыгровки: жетон, представление, удостоверение. Изменить можно в настройках.
            </p>
            <ProfileFields profile={profile} onChange={(patch) => setProfile((p) => ({ ...p, ...patch }))} />
          </>
        )}

        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, color: 'var(--text-2)' }}>
            <p style={{ margin: 0 }}>
              В GTA V откройте «Настройки → Графика → Режим экрана» и поставьте <b>«Оконный без рамки»</b>. Поверх
              полноэкранного режима никакие окна не видны — ни панель, ни уведомления.
            </p>
            <div className="card" style={{ gap: 10 }}>
              <div className="status-row" style={{ padding: 0, fontSize: 14 }}>
                <span className={`dot${elevated ? ' ok' : ' warn'}`} />
                {elevated ? 'Права администратора есть' : 'Нет прав администратора'}
                {!elevated && (
                  <button type="button" onClick={() => api.restartAsAdmin()}>
                    перезапустить с правами
                  </button>
                )}
              </div>
              <div className="status-row" style={{ padding: 0, fontSize: 14 }}>
                <span className={`dot${game.active ? ' ok' : ''}`} />
                {game.active ? 'GTA найдена — всё готово' : 'Запустите GTA и переключитесь на неё — здесь загорится зелёная точка'}
              </div>
              {!game.active && game.foregroundExe && (
                <span className="hint">Сейчас активно: {game.foregroundExe}. Если это игра — впишите имя в «Настройки → Игра».</span>
              )}
              {game.fullscreenSeen && (
                <span className="hint" style={{ color: 'var(--warn-text)' }}>
                  Игра сейчас в полноэкранном режиме — переключите на «Оконный без рамки».
                </span>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, color: 'var(--text-2)' }}>
            <div className="key-table">
              {hk.panel && (
                <>
                  <Kbd>{hk.panel}</Kbd>
                  <span>Панель в игре: избранные памятки, поиск статьи, алгоритм. Клики идут в игру.</span>
                </>
              )}
              {hk.interact && (
                <>
                  <Kbd>{hk.interact}</Kbd>
                  <span>Управлять панелью мышью и клавиатурой. Esc — обратно в игру.</span>
                </>
              )}
              {hk.window && (
                <>
                  <Kbd>{hk.window}</Kbd>
                  <span>Это большое окно — настройки, законы, редактор отыгровок.</span>
                </>
              )}
              {hk.stop && (
                <>
                  <Kbd>{hk.stop}</Kbd>
                  <span>Остановить отыгровку на полпути.</span>
                </>
              )}
              {binds.map((b) => (
                <span key={b.id} style={{ display: 'contents' }}>
                  <Kbd>{b.hotkey}</Kbd>
                  <span>{b.name}</span>
                </span>
              ))}
            </div>
            <p className="hint" style={{ margin: 0 }}>
              Все клавиши меняются в «Настройках» и в редакторе отыгровок. Проверить отыгровки без игры можно в тестовом режиме
              — они напечатаются, например, в Блокнот.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          {step > 0 && (
            <button type="button" className="btn" onClick={() => setStep((s) => s - 1)}>
              Назад
            </button>
          )}
          <span className="grow" />
          {step === 0 && (
            <button type="button" className="btn ghost" onClick={finish}>
              Пропустить
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn primary" onClick={() => setStep((s) => s + 1)}>
              Далее
            </button>
          ) : (
            <button type="button" className="btn primary" onClick={finish}>
              Готово
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
