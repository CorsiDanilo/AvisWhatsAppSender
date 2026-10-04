import sys
import os

# Assicuriamoci che la cartella corrente sia nel PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from src.app_ui import AvisWhatsAppApp

def main():
    app = AvisWhatsAppApp()
    app.mainloop()

if __name__ == "__main__":
    main()
