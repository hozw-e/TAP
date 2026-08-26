<?php
/**
 * NotificationService
 * 
 * Dispatches guardian notifications via IProgSMS API.
 * 
 * The guardian's phone number (guardian_cellnum) is used as the recipient.
 */

class NotificationService
{
    /** @var string IProgSMS API token */
    private string $smsApiToken;

    public function __construct()
    {
        $this->smsApiToken = defined('SMS_API_TOKEN') ? SMS_API_TOKEN : (getenv('SMS_API_TOKEN') ?: '');
        error_log("NotificationService: using IProgSMS token = " . (empty($this->smsApiToken) ? 'EMPTY' : substr($this->smsApiToken, 0, 8) . '...'));
    }

    /**
     * Send a notification to the guardian via IProgSMS.
     *
     * @param int    $guardianId Guardian's ID in the guardians table
     * @param int    $studentId  Student's ID (for logging)
     * @param string $eventType  'check_in' or 'check_out'
     * @param string $message    The formatted notification message
     * @param PDO    $conn       Database connection
     * @return array ['channel' => string|null, 'success' => bool, 'error' => string|null]
     */
    public function notify(int $guardianId, int $studentId, string $eventType, string $message, PDO $conn): array
    {
        // Look up guardian's phone number
        $stmt = $conn->prepare("
            SELECT guardian_cellnum 
            FROM guardians 
            WHERE guardian_id = :guardian_id
        ");
        $stmt->execute([':guardian_id' => $guardianId]);
        $guardian = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$guardian) {
            error_log("NotificationService: Guardian ID $guardianId not found in database.");
            return ['channel' => null, 'success' => false, 'error' => 'Guardian not found'];
        }

        $cellnum = $guardian['guardian_cellnum'] ?? null;

        if (empty($cellnum)) {
            error_log("NotificationService: No phone number for guardian ID $guardianId.");
            return ['channel' => null, 'success' => false, 'error' => 'No phone number available'];
        }

        // Send via IProgSMS
        $success = false;
        $error = null;

        try {
            $success = $this->sendIProgSms($cellnum, $message);
            if (!$success) {
                $error = 'IProgSMS returned non-success response';
            }
        } catch (\Exception $e) {
            $error = 'SMS error: ' . $e->getMessage();
            $success = false;
        }

        // Log the outcome
        $this->logOutcome($guardianId, $studentId, $eventType, 'sms', $success, $error, $conn);

        if (!$success) {
            error_log("NotificationService: IProgSMS failed for guardian $guardianId: $error");
        }

        return [
            'channel' => $success ? 'sms' : null,
            'success' => $success,
            'error'   => $error
        ];
    }

    /**
     * Send a message via IProgSMS API.
     *
     * @param string $recipient Guardian's phone number (e.g. 09XXXXXXXXX or 639XXXXXXXXX)
     * @param string $message   The notification text
     * @return bool True if the API returned a success status
     */
    private function sendIProgSms(string $recipient, string $message): bool
    {
        $url = 'https://www.iprogsms.com/api/v1/sms_messages';

        $payload = json_encode([
            'api_token'    => $this->smsApiToken,
            'phone_number' => $recipient,
            'message'      => $message,
        ]);

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
        ]);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);

        $result = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($curlError) {
            error_log("NotificationService::sendIProgSms cURL error: $curlError");
            throw new \Exception("cURL error: $curlError");
        }

        error_log("NotificationService::sendIProgSms to $recipient — HTTP $httpCode: $result");

        // IProgSMS returns {"status": 200, "message": "...", "message_id": "..."} on success
        $response = json_decode($result, true);
        return $httpCode === 200 && isset($response['status']) && $response['status'] === 200;
    }

    /**
     * Log a notification attempt to the notification_logs table.
     */
    private function logOutcome(int $guardianId, int $studentId, string $eventType, string $channel, bool $success, ?string $error, PDO $conn): void
    {
        try {
            $stmt = $conn->prepare("
                INSERT INTO notification_logs (guardian_id, student_id, event_type, channel, status, error_detail, sent_at)
                VALUES (:guardian_id, :student_id, :event_type, :channel, :status, :error_detail, NOW())
            ");
            $stmt->execute([
                ':guardian_id'  => $guardianId,
                ':student_id'   => $studentId,
                ':event_type'   => $eventType,
                ':channel'      => $channel,
                ':status'       => $success ? 'SENT' : 'FAILED',
                ':error_detail' => $error ? substr($error, 0, 255) : null,
            ]);
        } catch (\PDOException $e) {
            error_log("NotificationService::logOutcome DB error: " . $e->getMessage());
        }
    }

    /**
     * Format a check-in notification message.
     */
    public static function formatCheckInMessage(string $studentName, string $time): string
    {
        return "Your child $studentName has checked in at $time. - A+ Solutions Dev't Center";
    }

    /**
     * Format a check-out notification message.
     */
    public static function formatCheckOutMessage(string $studentName, string $time): string
    {
        return "Your child $studentName has checked out at $time. - A+ Solutions Dev't Center";
    }
}
