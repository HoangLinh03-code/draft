gsap.registerPlugin(Draggable);

// ==========================================
// 1. DATA CONFIG (KHO DỮ LIỆU DỤNG CỤ)
// ==========================================
const ITEM_DB = {
    "alcohol_lamp": {
        name: "Đèn cồn",
        icon: "fa-fire",
        type: "tool",
        templateId: "tpl-alcohol-lamp",
        className: "AlcoholLamp"
    },
    "matchbox": {
        name: "Hộp diêm",
        icon: "fa-box-tissue",
        type: "tool",
        templateId: "tpl-matchbox",
        className: "MatchBox"
    },
    "flask_glass": {
        name: "Bình nút mài",
        icon: "fa-flask",
        type: "glassware",
        templateId: "tpl-flask-glass",
        className: "Flask"
    },
    "flask_rubber": {
        name: "Bình nút cao su",
        icon: "fa-flask",
        type: "glassware",
        templateId: "tpl-flask-rubber",
        className: "Flask"
    },
    "jar_na": {
        name: "Lọ Natri",
        icon: "fa-bottle-droplet",
        type: "chemical",
        templateId: "tpl-jar-na",
        className: "ChemicalJar"
    },
    "spoon": {
        name: "Muỗng đốt",
        icon: "fa-spoon",
        type: "tool",
        templateId: "tpl-spoon",
        className: "CombustionTool" // Trở về vật thể đơn giản
    },
    "iron_wire": {
        name: "Dây sắt",
        icon: "fa-lines-leaning",
        type: "tool",
        templateId: "tpl-iron-wire",
        className: "CombustionTool" // Trở về vật thể đơn giản
    },
    "flask_cl2": {
        name: "Bình khí Chlorine",
        icon: "fa-flask",
        type: "chemical",
        templateId: "tpl-flask-glass",
        className: "Flask",
        data: { gas: "Cl2" }
    },
};

// ==========================================
// 2. OOP CLASSES (ĐỊNH NGHĨA DỤNG CỤ)
// ==========================================

class LabObject {
    constructor(config, x, y) {
        this.id = Date.now() + "_" + Math.random().toString(36).substr(2, 9);
        this.config = config;
        this.element = this.createDOM(x, y);
        this.setupCommonEvents();
    }

    createDOM(x, y) {
        const tpl = document.getElementById(this.config.templateId);
        const clone = tpl.content.cloneNode(true);
        const el = clone.querySelector('.lab-object');
        el.setAttribute('id', this.id);
        document.getElementById('simulation-container').appendChild(el);
        gsap.set(el, { x: x, y: y });
        return el;
    }

    setupCommonEvents() {
        this.initDraggable();
        this.setupDelete();
    }

    initDraggable() {
        Draggable.create(this.element, {
            type: "x,y",
            bounds: "#canvas-area",
            inertia: true,
            onPress: () => this.bringToFront()
        });
    }

    bringToFront() {
        gsap.set(this.element, { zIndex: Math.floor(Date.now() / 1000) % 10000 });
    }

    setupDelete() {
        const style = window.getComputedStyle(this.element);
        const isRootInteractive = style.pointerEvents !== 'none';
        let targets = isRootInteractive ? [this.element] : this.element.querySelectorAll('div:not(.flame):not(.active-match)');

        targets.forEach(part => {
            let lastRightClick = 0;
            part.addEventListener('contextmenu', (e) => {
                e.preventDefault(); e.stopPropagation();
                const now = Date.now();
                if (now - lastRightClick < 300) this.destroy();
                else lastRightClick = now;
            });
            part.addEventListener('mouseenter', () => labManager.hoveredObject = this);
            part.addEventListener('mouseleave', () => { if (labManager.hoveredObject === this) labManager.hoveredObject = null; });
        });
    }

    destroy() {
        if (this.onDestroy) this.onDestroy();
        this.element.style.pointerEvents = 'none';
        gsap.to(this.element, {
            scale: 0, opacity: 0, duration: 0.3,
            onComplete: () => {
                this.element.remove();
                labManager.removeObject(this.id);
            }
        });
    }

    checkCollision(el1, el2) {
        if (!el1 || !el2) return false;
        const r1 = el1.getBoundingClientRect();
        const r2 = el2.getBoundingClientRect();
        return !(r1.right < r2.left || r1.left > r2.right || r1.bottom < r2.top || r1.top > r2.bottom);
    }
}

// --- Lớp Đèn Cồn ---
class AlcoholLamp extends LabObject {
    constructor(config, x, y) {
        super(config, x, y);
        this.isLit = false;
        this.isLidOpen = false;
        this.activeFloatingLid = null;
        this.wick = this.element.querySelector('.lamp-wick');
        this.flame = this.element.querySelector('.lamp-flame');
        this.lid = this.element.querySelector('.lamp-lid');
        this.setupLidInteraction();
    }

    initDraggable() {
        Draggable.create(this.element, {
            type: "x,y", bounds: "#canvas-area", inertia: true,
            trigger: this.element.querySelector(".lamp-body"),
            onPress: () => this.bringToFront()
        });
    }

    setupLidInteraction() {
        this.lid.addEventListener('mousedown', (e) => {
            e.stopPropagation(); e.preventDefault();
            this.detachLid(e);
        });
    }

    detachLid(e) {
        const rect = this.lid.getBoundingClientRect();
        const containerRect = document.getElementById('simulation-container').getBoundingClientRect();
        const floatLid = this.lid.cloneNode(true);
        floatLid.classList.add('floating-lid');
        document.getElementById('simulation-container').appendChild(floatLid);

        gsap.set(floatLid, { x: rect.left - containerRect.left, y: rect.top - containerRect.top });
        this.lid.style.visibility = 'hidden';
        this.isLidOpen = true;
        this.activeFloatingLid = floatLid;

        const dragInstance = Draggable.create(floatLid, {
            type: "x,y", bounds: "#canvas-area", inertia: true,
            onDragEnd: () => {
                if (this.checkCollision(floatLid, this.wick)) this.snapLidBack(floatLid);
            }
        })[0];

        requestAnimationFrame(() => dragInstance.startDrag(e));
    }

    snapLidBack(floatLid) {
        const rect = this.lid.getBoundingClientRect();
        const containerRect = document.getElementById('simulation-container').getBoundingClientRect();
        gsap.to(floatLid, {
            x: rect.left - containerRect.left, y: rect.top - containerRect.top,
            duration: 0.2, onComplete: () => {
                floatLid.remove();
                this.activeFloatingLid = null;
                this.lid.style.visibility = 'visible';
                this.isLidOpen = false;
                this.extinguish();
            }
        });
    }

    ignite() {
        if (this.isLidOpen && !this.isLit) {
            this.isLit = true;
            this.flame.style.display = 'block';
            gsap.fromTo(this.flame, { scale:0, opacity:0 }, { scale:1, opacity:1, duration:0.5 });
            gsap.to(this.flame, { scale:1.05, yoyo:true, repeat:-1, duration:0.1 });
        }
    }

    extinguish() {
        this.isLit = false;
        gsap.killTweensOf(this.flame);
        gsap.to(this.flame, { scale:0, opacity:0, duration:0.2, onComplete: () => this.flame.style.display='none' });
    }

    onDestroy() {
        if (this.activeFloatingLid) this.activeFloatingLid.remove();
    }
}

// --- Lớp Hộp Diêm ---
class MatchBox extends LabObject {
    constructor(config, x, y) {
        super(config, x, y);
        this.trigger = this.element.querySelector('.match-trigger');
        this.trigger.addEventListener('mousedown', (e) => e.stopPropagation());
        this.trigger.addEventListener('click', () => this.spawnMatch());
    }

    spawnMatch() {
        const container = document.getElementById('simulation-container');
        const matchEl = document.createElement('div');
        matchEl.className = 'active-match';
        matchEl.innerHTML = `<div class="match-flame"></div><div class="stick-head"></div><div class="stick-body"></div>`;
        
        const rect = this.trigger.getBoundingClientRect();
        const cRect = container.getBoundingClientRect();
        container.appendChild(matchEl);
        gsap.set(matchEl, { x: rect.left - cRect.left, y: rect.top - cRect.top, rotation: 15 });
        
        const flame = matchEl.querySelector('.match-flame');
        gsap.to(matchEl, { x: "+=80", y: "+=40", rotation: 0, duration: 0.4 });
        gsap.to(flame, { opacity: 1, duration: 0.2 });

        Draggable.create(matchEl, {
            type: "x,y", bounds: "#canvas-area",
            onDrag: function() {
                const head = matchEl.querySelector('.stick-head');
                labManager.objects.forEach(obj => {
                    if (obj instanceof AlcoholLamp && obj.checkCollision(head, obj.wick)) obj.ignite();
                });
            }
        });

        const visibleParts = matchEl.querySelectorAll('.stick-head, .stick-body');
        const performDelete = () => {
            visibleParts.forEach(p => p.style.pointerEvents = 'none');
            gsap.to(matchEl, { opacity: 0, scale: 0, duration: 0.2, onComplete: () => matchEl.remove() });
        };

        visibleParts.forEach(part => {
            let lastRight = 0;
            part.addEventListener('contextmenu', (e) => {
                e.preventDefault(); e.stopPropagation();
                if(Date.now() - lastRight < 300) performDelete();
                else lastRight = Date.now();
            });
            part.addEventListener('mouseenter', () => labManager.hoveredObject = { destroy: performDelete });
            part.addEventListener('mouseleave', () => labManager.hoveredObject = null);
        });

        gsap.delayedCall(10, () => { if(matchEl.parentNode) performDelete(); });
    }
}

// --- Lớp Chung cho Bình/Lọ (Có nắp) ---
class ContainerWithStopper extends LabObject {
    constructor(config, x, y) {
        super(config, x, y);
        this.isLidOpen = false;
        this.activeFloatingLid = null;
        this.lid = this.element.querySelector('[class*="stopper"], [class*="lid"]');
        this.body = this.element.querySelector('[class*="body"]');
        if (this.lid) this.setupLidInteraction();
    }

    initDraggable() {
        Draggable.create(this.element, {
            type: "x,y", bounds: "#canvas-area", inertia: true,
            trigger: this.element.querySelector('[class*="body"]'),
            onPress: () => this.bringToFront()
        });
    }

    setupLidInteraction() {
        this.lid.addEventListener('mousedown', (e) => {
            e.stopPropagation(); e.preventDefault();
            this.detachLid(e);
        });
    }

    detachLid(e) {
        const rect = this.lid.getBoundingClientRect();
        const containerRect = document.getElementById('simulation-container').getBoundingClientRect();
        const floatLid = this.lid.cloneNode(true);
        floatLid.classList.add('floating-stopper');
        document.getElementById('simulation-container').appendChild(floatLid);

        gsap.set(floatLid, { x: rect.left - containerRect.left, y: rect.top - containerRect.top });
        this.lid.style.visibility = 'hidden';
        this.isLidOpen = true;
        this.activeFloatingLid = floatLid;

        const dragInstance = Draggable.create(floatLid, {
            type: "x,y", bounds: "#canvas-area", inertia: true,
            onDragEnd: () => {
                if (this.checkCollision(floatLid, this.body)) this.snapLidBack(floatLid);
            }
        })[0];

        requestAnimationFrame(() => dragInstance.startDrag(e));
    }

    snapLidBack(floatLid) {
        const rect = this.lid.getBoundingClientRect();
        const containerRect = document.getElementById('simulation-container').getBoundingClientRect();
        gsap.to(floatLid, {
            x: rect.left - containerRect.left, y: rect.top - containerRect.top,
            duration: 0.2, onComplete: () => {
                floatLid.remove();
                this.activeFloatingLid = null;
                this.lid.style.visibility = 'visible';
                this.isLidOpen = false;
            }
        });
    }

    onDestroy() {
        if (this.activeFloatingLid) this.activeFloatingLid.remove();
    }
}

// --- Lớp Bình Tam Giác ---
class Flask extends ContainerWithStopper {
    constructor(config, x, y) {
        super(config, x, y);
        if (config.data && config.data.gas === "Cl2") this.setGas("Cl2");
    }

    setGas(type) {
        if (type === "Cl2") this.body.classList.add('has-cl2');
        else this.body.classList.remove('has-cl2');
    }
}

// --- Lớp Lọ Hóa Chất ---
class ChemicalJar extends ContainerWithStopper {
    constructor(config, x, y) {
        super(config, x, y);
    }
}

// ==========================================
// 3. SYSTEM MANAGER & UI
// ==========================================
const labManager = {
    objects: [], 
    hoveredObject: null,

    createObject: function(key, x, y) {
        const config = ITEM_DB[key];
        let newObj;
        switch (config.className) {
            case "AlcoholLamp": newObj = new AlcoholLamp(config, x, y); break;
            case "MatchBox": newObj = new MatchBox(config, x, y); break;
            case "Flask": newObj = new Flask(config, x, y); break;
            case "ChemicalJar": newObj = new ChemicalJar(config, x, y); break;
            default: newObj = new LabObject(config, x, y);
        }
        this.objects.push(newObj);
    },

    removeObject: function(id) {
        this.objects = this.objects.filter(o => o.id !== id);
    },

    clearAll: function() {
        this.objects.forEach(o => o.element.remove());
        document.querySelectorAll('.floating-lid, .floating-stopper, .active-match').forEach(el => el.remove());
        this.objects = [];
    }
};

// UI Render & Events
const itemsList = document.getElementById('items-list');
for (const [key, item] of Object.entries(ITEM_DB)) {
    const el = document.createElement('div');
    el.className = 'grid-item';
    el.innerHTML = `<div class="item-img"><i class="fa-solid ${item.icon} fa-2x"></i></div><span>${item.name}</span>`;
    el.addEventListener('click', () => {
        const canvas = document.getElementById('canvas-area');
        const x = (canvas.offsetWidth / 2) - 60 + (Math.random() - 0.5) * 40;
        const y = (canvas.offsetHeight / 2) - 80 + (Math.random() - 0.5) * 40;
        labManager.createObject(key, x, y);
    });
    itemsList.appendChild(el);
}

document.addEventListener('keydown', (e) => {
    if ((e.key === "Delete" || e.key === "Del") && labManager.hoveredObject) {
        labManager.hoveredObject.destroy();
        labManager.hoveredObject = null;
    }
});


class CombustionTool extends LabObject {
    constructor(config, x, y) {
        super(config, x, y);
        this.isAttached = false;
        this.attachedTo = null;
        this.dragInstance = Draggable.get(this.element);
    }

    setupCommonEvents() {
        super.setupCommonEvents();
        // Lắng nghe sự kiện thả chuột
        if (this.dragInstance) {
            this.dragInstance.eventCallback("onDragEnd", () => this.checkAttachToFlask());
        }
    }

    checkAttachToFlask() {
        if (this.isAttached) return;

        labManager.objects.forEach(obj => {
            if (obj instanceof Flask && obj.isLidOpen) {
                // Kiểm tra va chạm giữa dụng cụ và thân bình
                if (this.checkCollision(this.element, obj.element.querySelector('.flask-body'))) {
                    this.attachToFlask(obj);
                }
            }
        });
    }

    attachToFlask(flask) {
        this.isAttached = true;
        this.attachedTo = flask;
        flask.isLidOpen = false; // Bình coi như đã bị chặn bởi dụng cụ

        // Tính toán vị trí để nút cao su trên muỗng khớp với miệng bình
        const flaskRect = flask.element.getBoundingClientRect();
        const containerRect = document.getElementById('simulation-container').getBoundingClientRect();

        // Tọa độ X: Giữa cổ bình
        // Tọa độ Y: Điều chỉnh để nút cao su (ở y=50 trong SVG) nằm đúng miệng bình
        const targetX = (flaskRect.left - containerRect.left) + (flaskRect.width / 2) - 25;
        const targetY = (flaskRect.top - containerRect.top) - 45; 

        gsap.to(this.element, {
            x: targetX,
            y: targetY,
            duration: 0.3,
            ease: "back.out(1.7)",
            onComplete: () => {
                // Tùy chọn: Có thể khóa kéo dụng cụ khi đã cắm hoặc cho phép kéo ra để mở lại bình
                // Ở đây ta giữ nguyên để user có thể rút muỗng ra
            }
        });
        
        // Khi kéo dụng cụ đi chỗ khác, mở lại nắp bình
        this.dragInstance.eventCallback("onDrag", () => {
            if (this.isAttached) {
                this.isAttached = false;
                flask.isLidOpen = true;
                this.attachedTo = null;
            }
        });
    }
}