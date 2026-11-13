@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Construire LIMEN pour Windows
where node >nul 2>nul
if errorlevel 1 (
 echo Installe Node.js 22 LTS depuis https://nodejs.org puis relance ce fichier.
 pause
 exit /b 1
)
if not exist "node_modules\electron\dist\electron.exe" (
 call npm ci
 if errorlevel 1 goto erreur
)
call npm test
if errorlevel 1 goto erreur
call npm run dist:win
if errorlevel 1 goto erreur
echo.
echo L'installateur Windows se trouve dans le dossier dist.
explorer "%~dp0dist"
pause
exit /b 0
:erreur
echo La construction a echoue. Consulte les messages ci-dessus.
pause
exit /b 1
