<?php
// index.php - Punto de entrada del backend
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// Mostrar información básica de la API
if ($_SERVER['REQUEST_METHOD'] === 'GET' && $_SERVER['REQUEST_URI'] === '/') {
    echo json_encode([
        'message' => 'API Promoción Mundial 2026',
        'version' => '1.0.0',
        'status' => 'active',
        'endpoints' => [
            '/api/register' => 'POST - Registro de usuarios',
            '/api/login' => 'POST - Login de usuarios',
            '/api/admin-login' => 'POST - Login administrativo',
            '/api/upload-comprobante' => 'POST - Subir comprobante',
            '/api/validate-comprobante' => 'POST - Validar comprobante',
            '/api/get-clients' => 'GET - Obtener clientes',
            '/api/get-user-data' => 'GET - Datos de usuario',
            '/api/claim-prize' => 'POST - Reclamar premio',
            '/api/health' => 'GET - Estado del sistema'
        ]
    ]);
    exit;
}

// Redirigir a la API
require_once 'api/index.php';
?>