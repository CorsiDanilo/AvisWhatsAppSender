import os
import subprocess
import sys
import customtkinter

def build():
    ctk_path = os.path.dirname(customtkinter.__file__)
    print(f"[BUILD] CustomTkinter directory: {ctk_path}")

    # Su Windows, il separatore per --add-data è il punto e virgola ';'
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--noconsole",
        "--onefile",
        "--clean",
        "--name=AvisWhatsAppSender",
        f"--add-data={ctk_path};customtkinter/",
        "--collect-all=playwright",
        "main.py"
    ]

    print("[BUILD] Comando PyInstaller:", " ".join(cmd))
    result = subprocess.run(cmd)
    if result.returncode == 0:
        exe_path = os.path.abspath(os.path.join("dist", "AvisWhatsAppSender.exe"))
        root_exe = os.path.abspath("AvisWhatsAppSender.exe")
        import shutil
        shutil.copy2(exe_path, root_exe)
        print("\n==========================================")
        print("*** BUILD COMPLETATA CON SUCCESSO! ***")
        print(f"Eseguibile creato in:\n{exe_path}")
        print(f"E copiato nella root:\n{root_exe}")
        print("==========================================\n")
    else:
        print(f"\n[BUILD] Errore durante la compilazione, codice uscita: {result.returncode}")
        sys.exit(result.returncode)

if __name__ == "__main__":
    build()
