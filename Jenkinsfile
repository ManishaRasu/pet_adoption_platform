pipeline {
    agent any

    environment {
        COMPOSE_PROJECT_NAME = "tailmate"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build Docker Images') {
            steps {
                // Using generic script step (bat for Windows, sh for Linux)
                // Assuming Jenkins is running on the host OS
                script {
                    if (isUnix()) {
                        sh 'docker-compose build'
                    } else {
                        bat 'docker-compose build'
                    }
                }
            }
        }

        stage('Deploy with Docker Compose') {
            steps {
                script {
                    if (isUnix()) {
                        sh 'docker-compose up -d'
                    } else {
                        bat 'docker-compose up -d'
                    }
                }
            }
        }
    }
    
    post {
        always {
            echo 'Pipeline has finished execution.'
        }
        success {
            echo 'Deployment successful. Checking services...'
            script {
                    if (isUnix()) {
                        sh 'docker-compose ps'
                    } else {
                        bat 'docker-compose ps'
                    }
                }
        }
        failure {
            echo 'Deployment failed. Gathering logs...'
            script {
                    if (isUnix()) {
                        sh 'docker-compose logs'
                    } else {
                        bat 'docker-compose logs'
                    }
                }
        }
    }
}
