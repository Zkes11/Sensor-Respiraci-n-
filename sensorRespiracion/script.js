// Variables globales
let audioContext;
let analyser;
let microphone;
let dataArray;
let isMonitoring = false;
let breathData = {
    fuerza: 0,
    duracion: 0,
    ritmo: 0,
    calidad: 0,
    breathCount: 0,
    startTime: 0,
    lastBreathTime: 0
};

// Elementos del DOM
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const canvas = document.getElementById('waveform');
const ctx = canvas.getContext('2d');

// Configurar canvas
canvas.width = canvas.offsetWidth;
canvas.height = 200;

// Event listeners
startBtn.addEventListener('click', startMonitoring);
stopBtn.addEventListener('click', stopMonitoring);

// Iniciar monitoreo
async function startMonitoring() {
    try {
        // Verificar compatibilidad del navegador
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('Tu navegador no soporta acceso al micrófono.\n\nPor favor usa Chrome, Firefox o Edge en:\n- http://localhost\n- https://');
            return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        microphone = audioContext.createMediaStreamSource(stream);
        
        analyser.fftSize = 2048;
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        
        microphone.connect(analyser);
        
        isMonitoring = true;
        breathData.startTime = Date.now();
        breathData.lastBreathTime = Date.now();
        breathData.breathCount = 0;
        
        startBtn.disabled = true;
        stopBtn.disabled = false;
        
        animate();
        analyzeBreath();
        
    } catch (error) {
        let errorMsg = 'Error al acceder al micrófono:\n\n';
        
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            errorMsg += '❌ Permiso denegado\n\n';
            errorMsg += 'Soluciones:\n';
            errorMsg += '1. Haz clic en el ícono del candado/info en la barra de direcciones\n';
            errorMsg += '2. Permite el acceso al micrófono\n';
            errorMsg += '3. Recarga la página\n\n';
            errorMsg += 'O ejecuta la página en:\n';
            errorMsg += '• http://localhost (usando un servidor local)\n';
            errorMsg += '• https:// (conexión segura)';
        } else if (error.name === 'NotFoundError') {
            errorMsg += '❌ No se encontró ningún micrófono\n\n';
            errorMsg += 'Verifica que tu dispositivo tenga micrófono conectado.';
        } else if (error.name === 'NotReadableError') {
            errorMsg += '❌ El micrófono está siendo usado por otra aplicación\n\n';
            errorMsg += 'Cierra otras aplicaciones que puedan estar usando el micrófono.';
        } else {
            errorMsg += error.message;
        }
        
        alert(errorMsg);
    }
}

// Detener monitoreo
function stopMonitoring() {
    isMonitoring = false;
    
    if (microphone) {
        microphone.disconnect();
    }
    if (audioContext) {
        audioContext.close();
    }
    
    startBtn.disabled = false;
    stopBtn.disabled = true;
    
    // Limpiar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// Animar forma de onda
function animate() {
    if (!isMonitoring) return;
    
    requestAnimationFrame(animate);
    
    analyser.getByteTimeDomainData(dataArray);
    
    ctx.fillStyle = 'rgb(255, 255, 255)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgb(102, 126, 234)';
    ctx.beginPath();
    
    const sliceWidth = canvas.width / dataArray.length;
    let x = 0;
    
    for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * canvas.height / 2;
        
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
        
        x += sliceWidth;
    }
    
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
}

// Analizar respiración
function analyzeBreath() {
    if (!isMonitoring) return;
    
    analyser.getByteFrequencyData(dataArray);
    
    // Calcular fuerza (volumen promedio)
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
    }
    const average = sum / dataArray.length;
    breathData.fuerza = Math.min(100, Math.round((average / 128) * 100));
    
    // Detectar respiración (umbral de volumen)
    if (average > 30) {
        const now = Date.now();
        const timeSinceLastBreath = (now - breathData.lastBreathTime) / 1000;
        
        if (timeSinceLastBreath > 1) { // Evitar contar múltiples veces la misma respiración
            breathData.breathCount++;
            breathData.lastBreathTime = now;
            
            // Calcular ritmo (respiraciones por minuto)
            const totalTime = (now - breathData.startTime) / 1000 / 60;
            breathData.ritmo = Math.round(breathData.breathCount / totalTime);
        }
    }
    
    // Calcular duración
    const totalSeconds = Math.floor((Date.now() - breathData.startTime) / 1000);
    breathData.duracion = totalSeconds;
    
    // Calcular calidad basada en métricas
    breathData.calidad = calculateQuality();
    
    updateUI();
    
    setTimeout(analyzeBreath, 100);
}

// Calcular calidad
function calculateQuality() {
    let score = 0;
    
    // Fuerza óptima entre 40-80%
    if (breathData.fuerza >= 40 && breathData.fuerza <= 80) {
        score += 35;
    } else if (breathData.fuerza >= 30 && breathData.fuerza <= 90) {
        score += 20;
    }
    
    // Ritmo óptimo entre 12-20 respiraciones por minuto
    if (breathData.ritmo >= 12 && breathData.ritmo <= 20) {
        score += 35;
    } else if (breathData.ritmo >= 8 && breathData.ritmo <= 25) {
        score += 20;
    }
    
    // Duración (dar puntos por mantener el ejercicio)
    if (breathData.duracion >= 30) {
        score += 30;
    } else {
        score += breathData.duracion;
    }
    
    return Math.min(100, score);
}

// Actualizar interfaz
function updateUI() {
    // Actualizar valores
    document.getElementById('fuerza').textContent = breathData.fuerza + '%';
    document.getElementById('duracion').textContent = breathData.duracion + 's';
    document.getElementById('ritmo').textContent = breathData.ritmo + ' RPM';
    document.getElementById('calidad').textContent = getQualityLabel(breathData.calidad);
    
    // Actualizar barras
    updateBar('fuerzaBar', breathData.fuerza, '#48bb78');
    updateBar('duracionBar', Math.min(100, (breathData.duracion / 60) * 100), '#4299e1');
    updateBar('ritmoBar', Math.min(100, (breathData.ritmo / 25) * 100), '#9f7aea');
    updateBar('calidadBar', breathData.calidad, getQualityColor(breathData.calidad));
    
    // Actualizar evaluación
    updateEvaluation();
}

// Actualizar barra
function updateBar(barId, percentage, color) {
    const bar = document.getElementById(barId);
    bar.style.width = percentage + '%';
    bar.style.backgroundColor = color;
}

// Obtener etiqueta de calidad
function getQualityLabel(score) {
    if (score >= 80) return 'Excelente';
    if (score >= 60) return 'Bueno';
    if (score >= 40) return 'Regular';
    return 'Mejorar';
}

// Obtener color de calidad
function getQualityColor(score) {
    if (score >= 80) return '#48bb78';
    if (score >= 60) return '#ecc94b';
    if (score >= 40) return '#ed8936';
    return '#f56565';
}

// Actualizar evaluación
function updateEvaluation() {
    const evaluation = document.getElementById('evaluation');
    let html = '<p><strong>Estado actual:</strong></p>';
    
    // Evaluación de fuerza
    if (breathData.fuerza < 30) {
        html += '<p>🔴 <strong>Fuerza:</strong> Respira con más intensidad</p>';
    } else if (breathData.fuerza > 85) {
        html += '<p>🟡 <strong>Fuerza:</strong> Reduce un poco la intensidad</p>';
    } else {
        html += '<p>🟢 <strong>Fuerza:</strong> Excelente control</p>';
    }
    
    // Evaluación de ritmo
    if (breathData.ritmo < 10) {
        html += '<p>🔴 <strong>Ritmo:</strong> Aumenta la frecuencia respiratoria</p>';
    } else if (breathData.ritmo > 22) {
        html += '<p>🟡 <strong>Ritmo:</strong> Respira más despacio</p>';
    } else if (breathData.ritmo > 0) {
        html += '<p>🟢 <strong>Ritmo:</strong> Frecuencia adecuada</p>';
    }
    
    // Evaluación de duración
    if (breathData.duracion < 20) {
        html += '<p>🟡 <strong>Duración:</strong> Continúa con el ejercicio</p>';
    } else {
        html += '<p>🟢 <strong>Duración:</strong> Buen tiempo de práctica</p>';
    }
    
    // Evaluación general
    html += '<p style="margin-top: 15px; padding-top: 15px; border-top: 2px solid #e2e8f0;"><strong>Evaluación general:</strong> ' + getQualityLabel(breathData.calidad) + '</p>';
    
    if (breathData.calidad >= 80) {
        html += '<p>¡Excelente trabajo! Mantén este nivel de control respiratorio.</p>';
    } else if (breathData.calidad >= 60) {
        html += '<p>Buen progreso. Enfócate en mantener un ritmo constante.</p>';
    } else {
        html += '<p>Sigue practicando. Intenta respirar de manera más controlada y constante.</p>';
    }
    
    evaluation.innerHTML = html;
}