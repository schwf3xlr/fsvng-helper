; ФСВНГ Helper — дополнения к установщику electron-builder.
;
; 1. Временные файлы — на диске, куда ставится программа. Иначе распаковка (около
;    0,5 ГБ) идёт во временную папку Windows на диске C, и при заполненном C установка
;    падает с «ошибка записи файла», даже если ставить на D.
; 2. Папку программы вне Program Files может менять только администратор — как Program
;    Files. Тогда программа может запускаться с правами без вопроса Windows (см.
;    src/main/elevation.ts).
; 3. Копию установщика для «дельта»-обновлений на почти полном диске C не оставляем.
; 4. При удалении программы убираем её задачи из планировщика.

!include "FileFunc.nsh"
!include "LogicLib.nsh"

!ifndef BUILD_UNINSTALLER

Function fsvngTempOnInstallDrive
  Push $R8
  Push $R9
  ${GetRoot} "$INSTDIR" $R8
  ${GetRoot} "$TEMP" $R9
  ${If} $R8 != ""
  ${AndIf} $R8 != $R9
  ${AndIf} $PLUGINSDIR != "$R8\FSVNG Helper setup.tmp"
    CreateDirectory "$R8\FSVNG Helper setup.tmp"
    ${If} ${FileExists} "$R8\FSVNG Helper setup.tmp\*.*"
      ; NSIS сам удалит эту папку при выходе; плагины при необходимости распакуются заново
      UnsafeStrCpy $PLUGINSDIR "$R8\FSVNG Helper setup.tmp"
    ${EndIf}
  ${EndIf}
  Pop $R9
  Pop $R8
FunctionEnd

; Пустая страница после выбора папки: только переносит временные файлы
Function fsvngTempPage
  Call fsvngTempOnInstallDrive
  Abort
FunctionEnd

!macro customInit
  ; Обновление ставится в ту же папку — она уже известна из реестра
  Call fsvngTempOnInstallDrive
!macroend

!macro customPageAfterChangeDir
  Page custom fsvngTempPage
!macroend

!macro customInstall
  ; Вне Program Files — права на папку как у Program Files
  StrLen $R6 "$PROGRAMFILES64\"
  StrCpy $R7 "$INSTDIR\" $R6
  ${If} $R7 != "$PROGRAMFILES64\"
    nsExec::Exec 'icacls "$INSTDIR" /inheritance:r /grant:r *S-1-5-32-544:(OI)(CI)F *S-1-5-18:(OI)(CI)F *S-1-5-32-545:(OI)(CI)RX /C /Q'
    Pop $R7
    nsExec::Exec 'icacls "$INSTDIR\*" /reset /T /C /Q'
    Pop $R7
    nsExec::Exec 'icacls "$INSTDIR" /setowner *S-1-5-32-544 /T /C /Q'
    Pop $R7
  ${EndIf}

  ; Копия установщика лежит в профиле пользователя на диске C. Если там меньше 1 ГБ
  ; свободного места — удаляем её: обновления просто будут скачиваться целиком
  SetShellVarContext current
  ${GetRoot} "$LOCALAPPDATA" $R6
  ${DriveSpace} "$R6\" "/D=F /S=M" $R7
  ${If} $R7 < 1024
    Delete "$LOCALAPPDATA\${APP_INSTALLER_STORE_FILE}"
  ${EndIf}
  ${If} $installMode == "all"
    SetShellVarContext all
  ${EndIf}
!macroend

!endif

!macro customUnInstall
  ; Удаление из «Установки и удаления программ» — убираем задачи планировщика.
  ; При обновлении (--updated) задачи нужны новой версии
  ${IfNot} ${isUpdated}
    nsExec::Exec `powershell.exe -NoProfile -NonInteractive -Command "Get-ScheduledTask -TaskName 'FSVNG Helper*' -ErrorAction SilentlyContinue | Unregister-ScheduledTask -Confirm:$$false"`
    Pop $R7
  ${EndIf}
!macroend
