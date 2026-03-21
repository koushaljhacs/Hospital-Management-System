
const path = require('path');

try {
    console.log('Attempting to require radiologistRoutes.js');
    const routes = require(path.join(__dirname, './src/routes/v1/radiologistRoutes.js'));
    console.log('Successfully required radiologistRoutes.js');
    console.log(routes);
} catch (error) {
    console.error('Failed to require radiologistRoutes.js');
    console.error(error);
}
