<?php
/**
 * NotificationService
 * 
 * Dispatches guardian notifications via SMS API PH.
 * SMS API PH handles fallback internally: SMS → Email → Push Notification.
 * 
 * The guardian's phone number (guardian_cellnum) is used as the primary recipient.
 * SMS API PH's intelligent fallback automatically routes to email/push if SMS fails.
 */

class NotificationService
{
    /** @var string SMS API PH API key */
    private string $smsApiPhKey;

    public function __construct()
    {
        $this->smsApiPhKey = getenv('SMSAPIPH_API_KEY') ?: '';
    }

    /**
     * Send a notification to the guardian via SMS API PH.
     * The API handles fallback (SMS → Email → Push) automatically.
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

        // Send via SMS API PH (handles SMS → Email → Push fallback internally)
        $success = false;
        $error = null;

        try {
            $success = $this->sendSmsApiPh($cellnum, $message);
            if (!$success) {
                $error = 'SMS API PH returned non-success response';
            }
        } catch (\Exception $e) {
            $error = 'SMS error: ' . $e->getMessage();
            $success = false;
        }

        // Log the outcome
        $this->logOutcome($guardianId, $studentId, $eventType, 'sms', $success, $error, $conn);

        if (!$success) {
            error_log("NotificationService: SMS API PH failed for guardian $guardianId: $error");
        }

        return [
            'channel' => $success ? 'sms' : null,
            'success' => $success,
            'error'   => $error
        ];
    }

    /**
     * Send a message via SMS API PH (free SMS API for Philippine numbers).
     * POSTs to https://smsapiph.onrender.com/api/v1/send/sms
     * The API handles fallback automatically: SMS → Email → Push Notification.
     *
     * @param string $recipient Guardian's phone number (e.g. +639XXXXXXXXX)
     * @param string $message   The notification text
     * @return bool True if the API returned a 2xx status
     */
    private function sendSmsApiPh(string $recipient, string $message): bool
    {
        $url = 'https://smsapiph.onrender.com/api/v1/send/sms';

        $payload = json_encode([
            'recipient' => $recipient,
            'message'   => $message,
        ]);

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'x-api-key: ' . $this->smsApiPhKey,
        ]);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);

        $result = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($curlError) {
            error_log("NotificationService::sendSmsApiPh cURL error: $curlError");
            throw new \Exception("cURL error: $curlError");
        }

        error_log("NotificationService::sendSmsApiPh to $recipient — HTTP $httpCode: $result");

        return $httpCode >= 200 && $httpCode < 300;
    }

    // =========================================================================
    // LEGACY: IProgSMS implementation (commented out, replaced by SMS API PH)
    // =========================================================================
    // private function sendIProgSms(string $recipient, string $message): bool
    // {
    //     $url = 'https://api.iprogsms.com/api/sms/send';
    //     $payload = json_encode([
    //         'to'      => $recipient,
    //         'message' => $message,
    //     ]);
    //     $ch = curl_init($url);
    //     curl_setopt($ch, CURLOPT_POST, true);
    //     curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    //     curl_setopt($ch, CURLOPT_HTTPHEADER, [
    //         'Content-Type: application/json',
    //         'Authorization: Bearer ' . SMS_API_TOKEN,
    //     ]);
    //     curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    //     curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    //     $result = curl_exec($ch);
    //     $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    //     curl_close($ch);
    //     return $httpCode >= 200 && $httpCode < 300;
    // }
    // =========================================================================

    // =========================================================================
    // LEGACY: Messenger & Viber channels (commented out, no longer needed)
    // SMS API PH handles fallback internally (SMS → Email → Push)
    // =========================================================================
    // private function sendMessenger(string $psid, string $message): bool
    // {
    //     $url = 'https://graph.facebook.com/v18.0/me/messages?access_token=' . urlencode($this->messengerToken);
    //     $payload = json_encode([
    //         'recipient' => ['id' => $psid],
    //         'message'   => ['text' => $message],
    //     ]);
    //     $ch = curl_init($url);
    //     curl_setopt($ch, CURLOPT_POST, true);
    //     curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    //     curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    //     curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    //     curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    //     $result = curl_exec($ch);
    //     $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    //     curl_close($ch);
    //     return $httpCode >= 200 && $httpCode < 300;
    // }
    //
    // private function sendViber(string $viberId, string $message): bool
    // {
    //     $url = 'https://chatapi.viber.com/pa/send_message';
    //     $payload = json_encode([
    //         'receiver' => $viberId,
    //         'type'     => 'text',
    //         'text'     => $message,
    //     ]);
    //     $ch = curl_init($url);
    //     curl_setopt($ch, CURLOPT_POST, true);
    //     curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    //     curl_setopt($ch, CURLOPT_HTTPHEADER, [
    //         'Content-Type: application/json',
    //         'X-Viber-Auth-Token: ' . $this->viberToken,
    //     ]);
    //     curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    //     curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    //     $result = curl_exec($ch);
    //     $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    //     curl_close($ch);
    //     if ($httpCode >= 200 && $httpCode < 300) {
    //         $responseData = json_decode($result, true);
    //         return isset($responseData['status']) && $responseData['status'] === 0;
    //     }
    //     return false;
    // }
    // =========================================================================

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
