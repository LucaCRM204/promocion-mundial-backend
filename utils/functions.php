<?php
// utils/functions.php

function logActivity($admin_user_id, $action, $description) {
    global $pdo;
    
    try {
        $ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $user_agent = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
        
        $stmt = $pdo->prepare("
            INSERT INTO system_logs (usuario_admin_id, accion, descripcion, ip_address, user_agent) 
            VALUES (?, ?, ?, ?, ?)
        ");
        
        $stmt->execute([$admin_user_id, $action, $description, $ip, $user_agent]);
    } catch (Exception $e) {
        error_log("Error logging activity: " . $e->getMessage());
    }
}

function formatFileSize($bytes) {
    if ($bytes >= 1073741824) {
        $bytes = number_format($bytes / 1073741824, 2) . ' GB';
    } elseif ($bytes >= 1048576) {
        $bytes = number_format($bytes / 1048576, 2) . ' MB';
    } elseif ($bytes >= 1024) {
        $bytes = number_format($bytes / 1024, 2) . ' KB';
    } elseif ($bytes > 1) {
        $bytes = $bytes . ' bytes';
    } elseif ($bytes == 1) {
        $bytes = $bytes . ' byte';
    } else {
        $bytes = '0 bytes';
    }
    return $bytes;
}

function sanitizeFileName($filename) {
    // Remover caracteres peligrosos
    $filename = preg_replace('/[^a-zA-Z0-9._-]/', '', $filename);
    return $filename;
}

function validateEmail($email) {
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

function validateDNI($dni) {
    // Solo números, entre 7 y 8 dígitos
    return preg_match('/^[0-9]{7,8}$/', $dni);
}

function generateSecureToken($length = 32) {
    return bin2hex(random_bytes($length));
}

function sendEmail($to, $subject, $body, $isHTML = true) {
    // Configuración básica de email
    $headers = [
        'MIME-Version: 1.0',
        'Content-type: text/html; charset=utf-8',
        'From: Sistema Promocion Mundial <noreply@promocionmundial2026.com>',
        'Reply-To: noreply@promocionmundial2026.com',
        'X-Mailer: PHP/' . phpversion()
    ];
    
    try {
        return mail($to, $subject, $body, implode("\r\n", $headers));
    } catch (Exception $e) {
        error_log("Error sending email: " . $e->getMessage());
        return false;
    }
}

function validateFileUpload($file) {
    $errors = [];
    
    // Verificar si hay errores en la subida
    if ($file['error'] !== UPLOAD_ERR_OK) {
        switch ($file['error']) {
            case UPLOAD_ERR_INI_SIZE:
                $errors[] = 'El archivo es demasiado grande';
                break;
            case UPLOAD_ERR_FORM_SIZE:
                $errors[] = 'El archivo excede el tamaño permitido';
                break;
            case UPLOAD_ERR_PARTIAL:
                $errors[] = 'La subida fue interrumpida';
                break;
            case UPLOAD_ERR_NO_FILE:
                $errors[] = 'No se seleccionó ningún archivo';
                break;
            default:
                $errors[] = 'Error desconocido en la subida';
        }
    }
    
    // Verificar tipo de archivo
    $allowed_types = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!in_array($file['type'], $allowed_types)) {
        $errors[] = 'Tipo de archivo no permitido. Solo JPG, PNG o PDF';
    }
    
    // Verificar tamaño (10MB máximo)
    $max_size = 10 * 1024 * 1024;
    if ($file['size'] > $max_size) {
        $errors[] = 'El archivo es demasiado grande. Máximo 10MB';
    }
    
    // Verificar que el archivo sea válido
    if (!is_uploaded_file($file['tmp_name'])) {
        $errors[] = 'Archivo inválido';
    }
    
    return $errors;
}

function createBackup() {
    global $pdo;
    
    try {
        $backup_dir = '../backups/';
        if (!is_dir($backup_dir)) {
            mkdir($backup_dir, 0755, true);
        }
        
        $filename = 'backup_' . date('Y-m-d_H-i-s') . '.sql';
        $filepath = $backup_dir . $filename;
        
        // Obtener todas las tablas
        $tables = [];
        $result = $pdo->query("SHOW TABLES");
        while ($row = $result->fetch(PDO::FETCH_NUM)) {
            $tables[] = $row[0];
        }
        
        $output = "-- Backup generado el " . date('Y-m-d H:i:s') . "\n";
        $output .= "-- Sistema Promoción Mundial 2026\n\n";
        
        foreach ($tables as $table) {
            // Estructura de la tabla
            $result = $pdo->query("SHOW CREATE TABLE `$table`");
            $row = $result->fetch(PDO::FETCH_NUM);
            $output .= "DROP TABLE IF EXISTS `$table`;\n";
            $output .= $row[1] . ";\n\n";
            
            // Datos de la tabla
            $result = $pdo->query("SELECT * FROM `$table`");
            while ($row = $result->fetch(PDO::FETCH_NUM)) {
                $output .= "INSERT INTO `$table` VALUES (";
                for ($i = 0; $i < count($row); $i++) {
                    if (is_null($row[$i])) {
                        $output .= "NULL";
                    } else {
                        $output .= "'" . addslashes($row[$i]) . "'";
                    }
                    if ($i < count($row) - 1) $output .= ",";
                }
                $output .= ");\n";
            }
            $output .= "\n";
        }
        
        file_put_contents($filepath, $output);
        
        return [
            'success' => true,
            'filename' => $filename,
            'filepath' => $filepath,
            'size' => formatFileSize(filesize($filepath))
        ];
        
    } catch (Exception $e) {
        error_log("Error creating backup: " . $e->getMessage());
        return [
            'success' => false,
            'error' => $e->getMessage()
        ];
    }
}

function cleanOldFiles($directory, $days = 30) {
    if (!is_dir($directory)) return false;
    
    $files_removed = 0;
    $cutoff_time = time() - ($days * 24 * 60 * 60);
    
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($directory)
    );
    
    foreach ($iterator as $file) {
        if ($file->isFile() && $file->getMTime() < $cutoff_time) {
            if (unlink($file->getPathname())) {
                $files_removed++;
            }
        }
    }
    
    return $files_removed;
}

function validatePassword($password) {
    $errors = [];
    
    if (strlen($password) < 6) {
        $errors[] = 'La contraseña debe tener al menos 6 caracteres';
    }
    
    if (!preg_match('/[A-Za-z]/', $password)) {
        $errors[] = 'La contraseña debe contener al menos una letra';
    }
    
    if (!preg_match('/[0-9]/', $password)) {
        $errors[] = 'La contraseña debe contener al menos un número';
    }
    
    return $errors;
}

function rateLimitCheck($identifier, $max_requests = 10, $window = 60) {
    // Simple rate limiting usando archivos
    $rate_limit_dir = '../temp/rate_limits/';
    if (!is_dir($rate_limit_dir)) {
        mkdir($rate_limit_dir, 0755, true);
    }
    
    $file = $rate_limit_dir . md5($identifier) . '.txt';
    $current_time = time();
    
    if (file_exists($file)) {
        $data = json_decode(file_get_contents($file), true);
        
        // Limpiar requests antiguos
        $data = array_filter($data, function($timestamp) use ($current_time, $window) {
            return $timestamp > ($current_time - $window);
        });
        
        if (count($data) >= $max_requests) {
            return false; // Rate limit exceeded
        }
    } else {
        $data = [];
    }
    
    $data[] = $current_time;
    file_put_contents($file, json_encode($data));
    
    return true; // Request allowed
}

function getClientIP() {
    $ip_keys = ['HTTP_CLIENT_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'];
    
    foreach ($ip_keys as $key) {
        if (array_key_exists($key, $_SERVER) === true) {
            foreach (explode(',', $_SERVER[$key]) as $ip) {
                $ip = trim($ip);
                if (filter_var($ip, FILTER_VALIDATE_IP, 
                    FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) !== false) {
                    return $ip;
                }
            }
        }
    }
    
    return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
}

function generateReportHTML($data, $title = 'Reporte del Sistema') {
    $html = "
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset='UTF-8'>
        <title>$title</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
            .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
            .stat-number { font-size: 2rem; font-weight: bold; color: #0984e3; }
            .stat-label { color: #666; margin-top: 5px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background: #f8f9fa; font-weight: bold; }
            .footer { text-align: center; color: #666; font-size: 0.9rem; margin-top: 30px; }
        </style>
    </head>
    <body>
        <div class='header'>
            <h1>$title</h1>
            <p>Generado el " . date('d/m/Y H:i:s') . "</p>
        </div>
    ";
    
    // Agregar estadísticas si existen
    if (isset($data['stats'])) {
        $html .= "<div class='stats'>";
        foreach ($data['stats'] as $key => $value) {
            $label = ucfirst(str_replace('_', ' ', $key));
            $html .= "
                <div class='stat-card'>
                    <div class='stat-number'>$value</div>
                    <div class='stat-label'>$label</div>
                </div>
            ";
        }
        $html .= "</div>";
    }
    
    // Agregar tablas de datos
    foreach ($data as $section => $items) {
        if ($section === 'stats' || !is_array($items) || empty($items)) continue;
        
        $html .= "<h2>" . ucfirst($section) . "</h2>";
        $html .= "<table>";
        
        // Header
        if (!empty($items)) {
            $html .= "<thead><tr>";
            foreach (array_keys($items[0]) as $column) {
                if ($column !== 'password') {
                    $html .= "<th>" . ucfirst(str_replace('_', ' ', $column)) . "</th>";
                }
            }
            $html .= "</tr></thead>";
            
            // Rows
            $html .= "<tbody>";
            foreach ($items as $item) {
                $html .= "<tr>";
                foreach ($item as $key => $value) {
                    if ($key !== 'password') {
                        $html .= "<td>" . htmlspecialchars($value ?? '') . "</td>";
                    }
                }
                $html .= "</tr>";
            }
            $html .= "</tbody>";
        }
        
        $html .= "</table>";
    }
    
    $html .= "
        <div class='footer'>
            <p>Sistema Promoción Mundial 2026 - Reporte generado automáticamente</p>
        </div>
    </body>
    </html>
    ";
    
    return $html;
}
?>