# Agnostic Push Notification Microservice

Welcome to our newest open-source software project - an agnostic push notification microservice! This service is developed using AWS Cloud Development Kit (CDK) and JavaScript, offering a highly flexible and efficient solution for managing push notifications in mobile applications.

This project is developed by [HyperSense Software](https://hypersense-software.com/) and it is distributed under an MIT License.

Our agnostic push notification microservice leverages the power of AWS services to provide a seamless experience. At its core, the API Gateway exposes endpoints that enable mobile apps to register Firebase tokens. With the help of AWS Cognito, secure access is ensured through the authorization of incoming requests.

This microservice is designed to handle various aspects of push notifications, including associating user IDs with their respective Firebase tokens, sending push notifications, maintaining read counts, managing notification lists, and offering other functionalities aimed at improving the push notification experience.

Another vital element of the microservice is an SQS queue that allows other microservices to send push notifications to users. By saving sent messages and maintaining logs using DynamoDB, the push notification microservice offers a reliable and efficient method for tracking notifications and ensuring smooth operation.

# Microservice high-level diagram

Please find below a high-level diagram outlining the main components of this node.js microservice. 

![push notification node.js microservice](https://hypersense-software.com/blogs-assets/a4c4cc18-f373-4701-8cf5-18fd66b128be/Notifications-CDK.jpg)
