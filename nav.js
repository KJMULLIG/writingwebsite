// Navigation bar configuration and rendering
// This file is shared across all pages to maintain consistent navigation

function renderNavigation(currentPage) {
    const navItems = [
        { text: 'Current Story', href: '/', page: 'index' },
        { text: 'Information', href: 'information.html', page: 'information' },
        { text: 'Submit Chapter', href: 'submit.html', page: 'submit' },
        { text: 'Completed Stories', href: 'archive.html', page: 'archive' }
    ];
    
    let navHTML = '';
    
    navItems.forEach((item, index) => {
        if (index > 0) {
            navHTML += ' | ';
        }
        
        if (item.page === currentPage) {
            // Current page - make it bold and don't make it a link
            navHTML += '<strong>' + item.text + '</strong>';
        } else {
            // Other pages - regular link
            navHTML += '<a href="' + item.href + '">' + item.text + '</a>';
        }
    });
    
    navHTML += '\n    <hr>';
    
    return navHTML;
}

// Insert navigation into the page
function insertNavigation(currentPage) {
    const navContainer = document.getElementById('navigation');
    if (navContainer) {
        navContainer.innerHTML = renderNavigation(currentPage);
    }
}