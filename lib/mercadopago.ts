const MP_API = 'https://api.mercadopago.com'
const ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN

function getHeaders() {
    if (!ACCESS_TOKEN) throw new Error('MERCADOPAGO_ACCESS_TOKEN no configurado')
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
    }
}

export async function createSubscription(payerEmail: string, backUrl: string) {
    const res = await fetch(`${MP_API}/preapproval`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
            payer_email: payerEmail,
            back_url: backUrl,
            reason: 'ViaGrua Premium',
            auto_recurring: {
                frequency: 1,
                frequency_type: 'months',
                transaction_amount: 499,
                currency_id: 'UYU',
            },
            status: 'pending',
        }),
    })

    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('MP createSubscription error:', res.status, JSON.stringify(err))
        throw new Error(err.message || err.error || `Error MP: ${res.status} - ${JSON.stringify(err)}`)
    }

    return res.json()
}

export async function getSubscription(preapprovalId: string) {
    const res = await fetch(`${MP_API}/preapproval/${preapprovalId}`, {
        headers: getHeaders(),
    })

    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || `Error MP: ${res.status}`)
    }

    return res.json()
}

export async function cancelSubscription(preapprovalId: string) {
    const res = await fetch(`${MP_API}/preapproval/${preapprovalId}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ status: 'cancelled' }),
    })

    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || `Error MP: ${res.status}`)
    }

    return res.json()
}
