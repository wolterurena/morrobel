const crypto = require('crypto');

// Configuración de credenciales de Protrack365
const config = {
    account: 'lureña01',
    password: '654321',
    baseUrl: 'https://api.protrack365.com'
};

/**
 * Genera la firma (signature) requerida por el API de Protrack.
 * Algoritmo: md5(md5(password) + timestamp)
 * @param {string} password - Contraseña de la cuenta
 * @param {string} timestamp - Timestamp Unix en segundos (string de 10 dígitos)
 * @returns {string} Firma en formato hexadecimal de 32 caracteres en minúscula
 */
function generateSignature(password, timestamp) {
    const firstMd5 = crypto.createHash('md5').update(password).digest('hex').toLowerCase();
    const stringToHash = firstMd5 + timestamp;
    return crypto.createHash('md5').update(stringToHash).digest('hex').toLowerCase();
}

/**
 * Obtiene el token de acceso (access_token) desde la API de Protrack365.
 * El token tiene una validez de 2 horas (7200 segundos).
 */
async function getAccessToken() {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = generateSignature(config.password, timestamp);
    const accountEncoded = encodeURIComponent(config.account);
    const url = `${config.baseUrl}/api/authorization?time=${timestamp}&account=${accountEncoded}&signature=${signature}`;

    console.log(`[Autenticación] Solicitando token a: ${config.baseUrl}/api/authorization...`);

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.code === 0 && data.record) {
            console.log('[Autenticación] Éxito. Token obtenido correctamente.');
            return {
                accessToken: data.record.access_token,
                expiresIn: data.record.expires_in
            };
        } else {
            throw new Error(`Error en API (${data.code}): ${data.message || 'Código de respuesta no exitoso'}`);
        }
    } catch (error) {
        console.error('[Autenticación] Error al obtener el token:', error.message);
        throw error;
    }
}

/**
 * Obtiene la lista básica de dispositivos (vehículos) asociados a la cuenta.
 * @param {string} accessToken - Token de acceso activo
 */
async function getDeviceList(accessToken) {
    const url = `${config.baseUrl}/api/device/list?access_token=${accessToken}`;
    console.log('[Dispositivos] Obteniendo lista de vehículos...');

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.code === 0 && data.record) {
            return data.record; // Retorna array de dispositivos
        } else {
            throw new Error(`Error en API (${data.code}): ${data.message}`);
        }
    } catch (error) {
        console.error('[Dispositivos] Error al obtener lista:', error.message);
        throw error;
    }
}

/**
 * Obtiene la información de rastreo en tiempo real para una lista de IMEIs.
 * @param {string} accessToken - Token de acceso activo
 * @param {string[]} imeis - Array de strings con los IMEIs a consultar
 */
async function getRealtimeTrack(accessToken, imeis) {
    if (!imeis || imeis.length === 0) {
        return [];
    }

    // La API permite un máximo de 100 IMEIs por petición
    const imeisParam = imeis.slice(0, 100).join(',');
    const url = `${config.baseUrl}/api/track?access_token=${accessToken}&imeis=${imeisParam}`;
    console.log(`[Rastreo] Consultando ubicación en tiempo real para ${imeis.length} vehículos...`);

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.code === 0 && data.record) {
            return data.record; // Retorna array con la información de rastreo
        } else {
            throw new Error(`Error en API (${data.code}): ${data.message}`);
        }
    } catch (error) {
        console.error('[Rastreo] Error al consultar ubicación:', error.message);
        throw error;
    }
}

/**
 * Función principal que orquesta el flujo completo.
 */
async function main() {
    try {
        // 1. Obtener el token
        const auth = await getAccessToken();
        const token = auth.accessToken;
        console.log(`Token Activo: ${token.substring(0, 10)}... (Expira en: ${auth.expiresIn} segundos)\n`);

        // 2. Obtener lista de dispositivos/vehículos para tener los IMEIs
        const devices = await getDeviceList(token);
        console.log(`Se encontraron ${devices.length} vehículos en la cuenta:\n`);

        if (devices.length === 0) {
            console.log('No hay vehículos registrados en esta cuenta.');
            return;
        }

        // Mostrar tabla básica de los vehículos encontrados
        console.table(devices.map(d => ({
            IMEI: d.imei,
            Nombre: d.devicename,
            Modelo: d.devicetype,
            Placa: d.platenumber || 'N/A'
        })));

        // 3. Obtener el rastreo en tiempo real para los IMEIs encontrados
        const imeis = devices.map(d => d.imei);
        const trackingData = await getRealtimeTrack(token, imeis);

        console.log('\nInformación de Ubicación y Estado en Tiempo Real:\n');

        // Mapear los datos de rastreo combinados con el nombre del vehículo
        const detailedReport = trackingData.map(track => {
            const device = devices.find(d => d.imei === track.imei) || {};
            return {
                Nombre: device.devicename || 'Desconocido',
                IMEI: track.imei,
                Latitud: track.latitude,
                Longitud: track.longitude,
                Velocidad: `${track.speed} KM/H`,
                Dirección: `${track.course}°`,
                Ignición: track.accstatus === 1 ? 'ENCENDIDO' : track.accstatus === 0 ? 'APAGADO' : 'N/A',
                Batería: track.battery !== -1 ? `${track.battery}%` : 'N/A',
                Estado: track.datastatus === 2 ? 'En Línea' : track.datastatus === 4 ? 'Fuera de Línea' : `Otro (${track.datastatus})`,
                ÚltimoReporte: new Date(track.hearttime * 1000).toLocaleString()
            };
        });

        console.table(detailedReport);

    } catch (error) {
        console.error('\n[Proceso] Ocurrió un error en el flujo principal:', error.message);
    }
}

// Ejecutar script
main();