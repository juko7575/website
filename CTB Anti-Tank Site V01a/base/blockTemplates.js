window.BLOCK_TEMPLATES = {

    "card-nation": (block) => {

        return {
            ...block,

            type: "card",

            title: block.title || "Nation",

            icon: block.icon || "🏛",

            toc: block.toc ?? true
        };

    },

    "card-role": (block) => {

        return {
            ...block,

            type: "card",

            title: block.title || "Role",

            icon: block.icon || "🎯",

            toc: block.toc ?? true
        };

    },

    "card-period": (block) => {

        return {
            ...block,

            type: "card",

            title: block.title || "Period",

            icon: block.icon || "📅",

            toc: block.toc ?? true
        };

    },

    "card-content": (block) => {

        return {
            ...block,

            type: "card",

            title: block.title || "From:",

            toc: block.toc ?? true
        };

    },

    "card-armament": (block) => {

        return {
            ...block,

            type: "card",

            title: block.title || "Armament",

            icon: block.icon || "💣",

            toc: block.toc ?? true
        };

    },

    "card-weight": (block) => {

        return {
            ...block,

            type: "card",

            title: block.title || "Weight",

            icon: block.icon || "⚖️",

            toc: block.toc ?? true
        };

    },

    "card-identificaiton": (block) => {

        return {
            ...block,

            type: "card",

            title: block.title || "Identification",

            icon: block.icon || "🔎",

            toc: block.toc ?? true
        };

    },

    "card-conflicts": (block) => {

        return {
            ...block,

            type: "card",

            title: block.title || "Conflicts",

            icon: block.icon || "🕒",

            toc: block.toc ?? true
        };

    },

    "card-production": (block) => {

        return {
            ...block,

            type: "card",

            title: block.title || "Production",

            icon: block.icon || "📊",

            toc: block.toc ?? true
        };

    }

};