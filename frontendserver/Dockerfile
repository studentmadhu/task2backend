# Use the official Nginx image as base
FROM nginx:latest

# Set the working directory within the container
WORKDIR /usr/share/nginx/html

# Copy the current directory (which contains your static files) into the container
COPY . .

# Expose port 80 for Nginx
EXPOSE 80

# Start Nginx in the foreground when the container starts
CMD ["nginx", "-g", "daemon off;"]
