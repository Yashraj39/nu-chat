import {
    useEffect,
    useState,
} from "react";


export function useTheme() {

    const [dark, setDark] =
        useState(
            () =>
                localStorage.getItem(
                    "pulse_theme"
                ) === "dark"
        );


    useEffect(() => {

        document.documentElement.classList.toggle(
            "dark",
            dark
        );

        localStorage.setItem(
            "pulse_theme",
            dark
                ? "dark"
                : "light"
        );

    }, [dark]);


    return [
        dark,
        setDark,
    ] as const;
}