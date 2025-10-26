from supabase import create_client, Client
from dotenv import load_dotenv
import os

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Si no hay credenciales, el programa no puede funcionar. Lanzar un error claro.
if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError(
        "Error: Faltan las credenciales de Supabase. "
        "Asegúrate de crear un archivo .env en la carpeta 'backend' con tu SUPABASE_URL y SUPABASE_KEY."
    )

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
