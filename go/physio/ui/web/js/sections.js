// Section Navigation and Loading Module

const sections = {
    physio:  'sections/physio.html',
    aia:     'sections/aia.html',
    system:  'sections/system.html'
};

const sectionInitializers = {
    physio: () => {
        if (typeof initializePhysio === 'function') initializePhysio();
    },
    aia: () => {
        if (typeof initializeAia === 'function') initializeAia();
    },
    system: () => {
        if (typeof initializeL8Sys === 'function') initializeL8Sys();
    }
};

function loadSection(sectionName) {
    const contentArea = document.getElementById('content-area');
    const sectionFile = sections[sectionName];

    if (!sectionFile) {
        contentArea.innerHTML = '<div class="section-container"><h2 class="section-title">Error</h2><div class="section-content">Section not found.</div></div>';
        return;
    }

    contentArea.style.opacity = '0';
    contentArea.style.transform = 'translateY(20px)';

    fetch(sectionFile + '?t=' + new Date().getTime())
        .then(response => {
            if (!response.ok) throw new Error('Section not found');
            return response.text();
        })
        .then(html => {
            setTimeout(() => {
                contentArea.innerHTML = html;

                const placeholder = contentArea.querySelector('[id$="-section-placeholder"]');
                if (placeholder && window.Layer8SectionGenerator) {
                    const generatedHtml = Layer8SectionGenerator.generate(sectionName);
                    const temp = document.createElement('div');
                    temp.innerHTML = generatedHtml;
                    placeholder.replaceWith(...temp.children);
                }

                setTimeout(() => {
                    contentArea.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                    contentArea.style.opacity = '1';
                    contentArea.style.transform = 'translateY(0)';
                }, 50);

                const sectionContainer = contentArea.querySelector('.section-container');
                if (sectionContainer) {
                    sectionContainer.style.animation = 'fade-in-up 0.6s ease-out';
                }

                if (sectionInitializers[sectionName]) {
                    sectionInitializers[sectionName]();
                }
            }, 200);
        })
        .catch(() => {
            contentArea.innerHTML = '<div class="section-container"><h2 class="section-title">Error</h2><div class="section-content">Failed to load section content.</div></div>';
            contentArea.style.opacity = '1';
            contentArea.style.transform = 'translateY(0)';
        });
}
