import requests
from app.core.config import settings


def _api(path: str) -> str:
    return f"{settings.BARION_API_BASE}{path}"


def start_payment(
    payment_request_id: str,
    amount: int,
    title: str,
    redirect_url: str,
    callback_url: str,
) -> dict:
    """Elindít egy azonnali (Immediate) fizetést HUF-ban. Visszaadja a Barion választ (GatewayUrl, PaymentId)."""
    body = {
        "POSKey": settings.BARION_POS_KEY,
        "PaymentType": "Immediate",
        "PaymentRequestId": payment_request_id,
        "FundingSources": ["All"],
        "GuestCheckOut": True,
        "Locale": "hu-HU",
        "Currency": "HUF",
        "RedirectUrl": redirect_url,
        "CallbackUrl": callback_url,
        "Transactions": [
            {
                "POSTransactionId": payment_request_id,
                "Payee": settings.BARION_PAYEE,
                "Total": amount,
                "Comment": title,
                "Items": [
                    {
                        "Name": title,
                        "Description": title,
                        "Quantity": 1,
                        "Unit": "db",
                        "UnitPrice": amount,
                        "ItemTotal": amount,
                        "SKU": payment_request_id,
                    }
                ],
            }
        ],
    }
    resp = requests.post(_api("/v2/Payment/Start"), json=body, timeout=30)
    data = resp.json()
    return data


def get_payment_state(payment_id: str) -> dict:
    params = {"PaymentId": payment_id}
    headers = {"x-pos-key": settings.BARION_POS_KEY}
    resp = requests.get(_api("/v4/Payment/GetPaymentState"), params=params, headers=headers, timeout=30)
    return resp.json()
