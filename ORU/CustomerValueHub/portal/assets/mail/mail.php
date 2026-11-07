<?php
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Get user input & sanitize
    $name = htmlspecialchars(trim($_POST['name']));
    $company = htmlspecialchars(trim($_POST['company']));
    $email = filter_var(trim($_POST['email']), FILTER_SANITIZE_EMAIL);
    $subject = htmlspecialchars(trim($_POST['subject']));
    $message = htmlspecialchars(trim($_POST['message']));

    // Validate email
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        die("Invalid email format.");
    }

    // Construct email message
    $email_message = "
    Name: $name
    Company: $company
    Email: $email
    Subject: $subject
    Message: $message
    ";

    // Email headers
    $to = "name@youremail.com"; // Change to your email
    $headers = "From: $email\r\n" .
               "Reply-To: $email\r\n" .
               "X-Mailer: PHP/" . phpversion();

    // Send email & check if successful
    if (mail($to, "New Message from Contact Form", $email_message, $headers)) {
        header("Location: ../mail-success.html"); // Redirect to success page
        exit();
    } else {
        echo "Oops! There was a problem sending your message.";
    }
} else {
    echo "Unauthorized access!";
}
?>
