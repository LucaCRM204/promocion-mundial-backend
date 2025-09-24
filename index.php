<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Respuesta básica para la raíz
if ($path === '/' || $path === '/index.php') {
    echo json_encode([
        'message' => 'API Promoción Mundial 2026',
        'status' => 'active',
        'version' => '1.0.0'
    ]);
    exit;
}

// Health check
if ($path === '/api/health' || $path === '/health') {
    echo json_encode([
        'status' => 'healthy',
        'timestamp' => date('Y-m-d H:i:s'),
        'version' => '1.0.0'
    ]);
    exit;
}

// Otras rutas
echo json_encode(['error' => 'Endpoint no encontrado']);
http_response_code(404);
?>