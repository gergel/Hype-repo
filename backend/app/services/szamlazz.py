import requests
from datetime import date
from xml.sax.saxutils import escape
from app.core.config import settings

SZAMLAZZ_URL = "https://www.szamlazz.hu/szamla/"


def _seller_block() -> str:
    """Eladó blokk. A bankadatok opcionálisak; a cég adatai a Számlázz.hu fiókból jönnek."""
    return "<elado></elado>"


def create_invoice(
    *,
    buyer_name: str,
    buyer_zip: str,
    buyer_city: str,
    buyer_address: str,
    buyer_tax_number: str,
    buyer_email: str,
    item_name: str,
    gross_amount: int,
    vat_rate: int = 27,
) -> dict:
    """
    ÁFA-s számlát állít ki a Számlázz.hu Számla Agenttel.
    A gross_amount BRUTTÓ összeg (Ft). A nettót és az ÁFA-t visszaszámoljuk.
    Visszaad: {"ok": bool, "invoice_number": str, "error": str}
    """
    if not settings.SZAMLAZZ_AGENT_KEY:
        return {"ok": False, "invoice_number": "", "error": "No agent key configured"}

    # Bruttóból nettó + ÁFA (kerekítés forintra)
    net = round(gross_amount / (1 + vat_rate / 100))
    vat = gross_amount - net

    today = date.today().isoformat()

    # Vevő adószám csak cégnél (üres magánszemélynél)
    tax_line = f"<adoszam>{escape(buyer_tax_number)}</adoszam>" if buyer_tax_number else ""
    email_line = f"<email>{escape(buyer_email)}</email>" if buyer_email else ""

    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<xmlszamla xmlns="http://www.szamlazz.hu/xmlszamla" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamla https://www.szamlazz.hu/szamla/docs/xsds/agent/xmlszamla.xsd">
  <beallitasok>
    <szamlaagentkulcs>{escape(settings.SZAMLAZZ_AGENT_KEY)}</szamlaagentkulcs>
    <eszamla>true</eszamla>
    <szamlaLetoltes>false</szamlaLetoltes>
    <valaszVerzio>2</valaszVerzio>
  </beallitasok>
  <fejlec>
    <keltDatum>{today}</keltDatum>
    <teljesitesDatum>{today}</teljesitesDatum>
    <fizetesiHataridoDatum>{today}</fizetesiHataridoDatum>
    <fizmod>Bankkártya</fizmod>
    <penznem>HUF</penznem>
    <szamlaNyelve>hu</szamlaNyelve>
    <megjegyzes>HypeClient online tárhely-hosszabbítás</megjegyzes>
  </fejlec>
  <elado></elado>
  <vevo>
    <nev>{escape(buyer_name)}</nev>
    <irsz>{escape(buyer_zip)}</irsz>
    <telepules>{escape(buyer_city)}</telepules>
    <cim>{escape(buyer_address)}</cim>
    {email_line}
    {tax_line}
  </vevo>
  <tetelek>
    <tetel>
      <megnevezes>{escape(item_name)}</megnevezes>
      <mennyiseg>1</mennyiseg>
      <mennyisegiEgyseg>db</mennyisegiEgyseg>
      <nettoEgysegar>{net}</nettoEgysegar>
      <afakulcs>{vat_rate}</afakulcs>
      <nettoErtek>{net}</nettoErtek>
      <afaErtek>{vat}</afaErtek>
      <bruttoErtek>{gross_amount}</bruttoErtek>
    </tetel>
  </tetelek>
</xmlszamla>"""

    try:
        resp = requests.post(
            SZAMLAZZ_URL,
            files={"action-xmlagentxmlfile": ("invoice.xml", xml, "text/xml")},
            timeout=30,
        )
        text = resp.text or ""
        # Válasz XML-ből a számlaszám kiolvasása
        if "<sikeres>true</sikeres>" in text or "sikeres>true" in text:
            num = ""
            if "<szamlaszam>" in text:
                num = text.split("<szamlaszam>")[1].split("</szamlaszam>")[0]
            return {"ok": True, "invoice_number": num, "error": ""}
        # Hibaüzenet kiszedése
        err = text[:300]
        return {"ok": False, "invoice_number": "", "error": err}
    except Exception as e:
        return {"ok": False, "invoice_number": "", "error": str(e)}
