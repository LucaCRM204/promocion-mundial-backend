<?php
// config/database.php
$host = $_ENV['DB_HOST'] ?? 'localhost';
$dbname = $_ENV['DB_NAME'] ?? 'railway';
$username = $_ENV['DB_USER'] ?? 'root';
$password = $_ENV['DB_PASS'] ?? '';
$port = $_ENV['DB_PORT'] ?? 3306;

try {
    $dsn = "mysql:host=$host;port=$port;dbname=$dbname;charset=utf8mb4";
    $pdo = new PDO($dsn, $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    
    // Crear tablas si no existen
    createTablesIfNotExist($pdo);
    
} catch(PDOException $e) {
    error_log("Database connection error: " . $e->getMessage());
    http_response_code(500);
    die(json_encode(['error' => 'Error de conexión a la base de datos']));
}

function createTablesIfNotExist($pdo) {
    try {
        // Tabla usuarios
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS usuarios (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                apellido VARCHAR(100) NOT NULL,
                dni VARCHAR(20) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                telefono VARCHAR(20) NOT NULL,
                plan VARCHAR(255) DEFAULT 'No especificado',
                direccion TEXT NOT NULL,
                localidad VARCHAR(100) NOT NULL,
                codigo_postal VARCHAR(10) NOT NULL,
                password VARCHAR(255) NOT NULL,
                fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                estado ENUM('activo', 'inactivo') DEFAULT 'activo',
                INDEX idx_email (email),
                INDEX idx_dni (dni)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        
        // Tabla admin_usuarios
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS admin_usuarios (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                rol ENUM('validator', 'responsable', 'owner') NOT NULL,
                nombre VARCHAR(100) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                telefono VARCHAR(20),
                estado ENUM('activo', 'inactivo') DEFAULT 'activo',
                turno ENUM('morning', 'afternoon', 'full') DEFAULT 'full',
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ultimo_acceso TIMESTAMP NULL,
                INDEX idx_username (username),
                INDEX idx_rol (rol)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        
        // Tabla comprobantes
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS comprobantes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario_id INT NOT NULL,
                numero_cuota INT NOT NULL,
                nombre_archivo VARCHAR(255) NOT NULL,
                tipo_archivo VARCHAR(10) NOT NULL,
                tamaño_archivo INT NOT NULL,
                fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                estado ENUM('pending', 'validated', 'rejected', 'ready_delivery', 'dispatched', 'delivered') DEFAULT 'pending',
                validado_por INT NULL,
                fecha_validacion TIMESTAMP NULL,
                motivo_rechazo TEXT NULL,
                numero_tracking VARCHAR(100) NULL,
                empresa_envio VARCHAR(100) NULL,
                fecha_despacho TIMESTAMP NULL,
                fecha_entrega TIMESTAMP NULL,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
                FOREIGN KEY (validado_por) REFERENCES admin_usuarios(id),
                INDEX idx_usuario_cuota (usuario_id, numero_cuota),
                INDEX idx_estado (estado)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        
        // Tabla premios_reclamados
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS premios_reclamados (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario_id INT NOT NULL,
                numero_cuota INT NOT NULL,
                nombre_premio VARCHAR(255) NOT NULL,
                fecha_reclamo TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                estado_entrega ENUM('pendiente', 'preparando', 'enviado', 'entregado') DEFAULT 'pendiente',
                fecha_entrega TIMESTAMP NULL,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
                INDEX idx_usuario (usuario_id),
                INDEX idx_estado (estado_entrega)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        
        // Tabla system_logs
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS system_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario_admin_id INT NULL,
                accion VARCHAR(255) NOT NULL,
                descripcion TEXT,
                ip_address VARCHAR(45),
                user_agent TEXT,
                fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (usuario_admin_id) REFERENCES admin_usuarios(id),
                INDEX idx_fecha (fecha),
                INDEX idx_accion (accion)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        
        // Insertar usuarios admin por defecto
        insertDefaultAdminUsers($pdo);
        
    } catch (PDOException $e) {
        error_log("Error creating tables: " . $e->getMessage());
        throw $e;
    }
}

function insertDefaultAdminUsers($pdo) {
    try {
        // Verificar si ya existen usuarios admin
        $stmt = $pdo->query("SELECT COUNT(*) as count FROM admin_usuarios");
        $count = $stmt->fetch()['count'];
        
        if ($count == 0) {
            // Insertar usuarios por defecto
            $defaultUsers = [
                [
                    'username' => 'validator1',
                    'password' => password_hash('val123', PASSWORD_DEFAULT),
                    'rol' => 'validator',
                    'nombre' => 'Validador Principal',
                    'email' => 'validator@empresa.com'
                ],
                [
                    'username' => 'responsable1',
                    'password' => password_hash('resp123', PASSWORD_DEFAULT),
                    'rol' => 'responsable',
                    'nombre' => 'Responsable Principal',
                    'email' => 'responsable@empresa.com'
                ],
                [
                    'username' => 'owner',
                    'password' => password_hash('admin123', PASSWORD_DEFAULT),
                    'rol' => 'owner',
                    'nombre' => 'Administrador Principal',
                    'email' => 'admin@empresa.com'
                ]
            ];
            
            $stmt = $pdo->prepare("
                INSERT INTO admin_usuarios (username, password, rol, nombre, email) 
                VALUES (?, ?, ?, ?, ?)
            ");
            
            foreach ($defaultUsers as $user) {
                $stmt->execute([
                    $user['username'],
                    $user['password'],
                    $user['rol'],
                    $user['nombre'],
                    $user['email']
                ]);
            }
            
            error_log("Default admin users created successfully");
        }
        
    } catch (PDOException $e) {
        error_log("Error inserting default users: " . $e->getMessage());
    }
}
?>