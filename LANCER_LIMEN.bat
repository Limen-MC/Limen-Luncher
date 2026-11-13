@echo off
chcp 65001 >nul
cd /d "%~dp0"
title LIMEN Launcher
where node >nul 2>nul
if errorlevel 1 (
 echo Installe Node.js 22 LTS depuis https://nodejs.org puis relance ce fichier.
 pause
 exit /b 1
)
if not exist "node_modules\electron\dist\electron.exe" (
 echo Installation des dependances LIMEN...
 call npm ci
 if errorlevel 1 (
  echo L'installation a echoue. Verifie ta connexion et ta version de Node.js.
  pause
  exit /b 1
 )
)
call npm start
if errorlevel 1 pause
