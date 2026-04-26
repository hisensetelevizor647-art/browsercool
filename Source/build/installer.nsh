!macro customInstall
  ; Open With: show "Olewser" instead of generic Electron entry.
  WriteRegStr HKCU "Software\Classes\Applications\Olewser.exe" "FriendlyAppName" "Olewser"
  WriteRegStr HKCU "Software\Classes\Applications\Olewser.exe\DefaultIcon" "" "$INSTDIR\Olewser.exe,0"
  WriteRegStr HKCU "Software\Classes\Applications\Olewser.exe\shell\open\command" "" "$\"$INSTDIR\Olewser.exe$\" $\"%1$\""
  WriteRegStr HKCU "Software\Classes\Applications\Olewser.exe\SupportedTypes" ".html" ""
  WriteRegStr HKCU "Software\Classes\Applications\Olewser.exe\SupportedTypes" ".htm" ""
  WriteRegStr HKCU "Software\Classes\Applications\Olewser.exe\SupportedTypes" ".url" ""

  ; File associations with Olewser icon.
  WriteRegStr HKCU "Software\Classes\OlewserHTML" "" "Olewser HTML Document"
  WriteRegStr HKCU "Software\Classes\OlewserHTML\DefaultIcon" "" "$INSTDIR\Olewser.exe,0"
  WriteRegStr HKCU "Software\Classes\OlewserHTML\shell\open\command" "" "$\"$INSTDIR\Olewser.exe$\" $\"%1$\""
  WriteRegStr HKCU "Software\Classes\.html\OpenWithProgids" "OlewserHTML" ""
  WriteRegStr HKCU "Software\Classes\.htm\OpenWithProgids" "OlewserHTML" ""

  ; URL protocol registration.
  WriteRegStr HKCU "Software\Classes\OlewserURL" "" "URL:Olewser Protocol"
  WriteRegStr HKCU "Software\Classes\OlewserURL" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\OlewserURL\DefaultIcon" "" "$INSTDIR\Olewser.exe,0"
  WriteRegStr HKCU "Software\Classes\OlewserURL\shell\open\command" "" "$\"$INSTDIR\Olewser.exe$\" $\"%1$\""
  WriteRegStr HKCU "Software\Classes\http\OpenWithProgids" "OlewserURL" ""
  WriteRegStr HKCU "Software\Classes\https\OpenWithProgids" "OlewserURL" ""
  WriteRegStr HKCU "Software\Classes\.url\OpenWithProgids" "OlewserURL" ""

  ; Register browser capabilities so Olewser is selectable as default browser in Windows settings.
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Olewser.exe" "" "Olewser"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Olewser.exe\DefaultIcon" "" "$INSTDIR\Olewser.exe,0"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Olewser.exe\shell\open\command" "" "$\"$INSTDIR\Olewser.exe$\""
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Olewser.exe\Capabilities" "ApplicationName" "Olewser"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Olewser.exe\Capabilities" "ApplicationDescription" "Olewser web browser"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Olewser.exe\Capabilities\FileAssociations" ".htm" "OlewserHTML"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Olewser.exe\Capabilities\FileAssociations" ".html" "OlewserHTML"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Olewser.exe\Capabilities\URLAssociations" "http" "OlewserURL"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Olewser.exe\Capabilities\URLAssociations" "https" "OlewserURL"
  WriteRegStr HKCU "Software\RegisteredApplications" "Olewser" "Software\Clients\StartMenuInternet\Olewser.exe\Capabilities"
!macroend

!macro customUnInstall
  DeleteRegValue HKCU "Software\RegisteredApplications" "Olewser"
  DeleteRegValue HKCU "Software\Classes\.html\OpenWithProgids" "OlewserHTML"
  DeleteRegValue HKCU "Software\Classes\.htm\OpenWithProgids" "OlewserHTML"
  DeleteRegValue HKCU "Software\Classes\.url\OpenWithProgids" "OlewserURL"
  DeleteRegValue HKCU "Software\Classes\http\OpenWithProgids" "OlewserURL"
  DeleteRegValue HKCU "Software\Classes\https\OpenWithProgids" "OlewserURL"
  DeleteRegKey HKCU "Software\Classes\Applications\Olewser.exe"
  DeleteRegKey HKCU "Software\Classes\OlewserHTML"
  DeleteRegKey HKCU "Software\Classes\OlewserURL"
  DeleteRegKey HKCU "Software\Clients\StartMenuInternet\Olewser.exe"
!macroend
