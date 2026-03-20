import { defaultProps } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { Menu } from "@mantine/core";
import { AlertTriangle, XCircle, Info, CheckCircle2 } from "lucide-react";

// The types of alerts that users can choose from.
export const alertTypes = [
    {
        title: "Warning",
        value: "warning",
        icon: AlertTriangle,
        color: "#e69819",
        backgroundColor: {
            light: "#fff6e6",
            dark: "#805d20",
        },
    },
    {
        title: "Error",
        value: "error",
        icon: XCircle,
        color: "#d80d0d",
        backgroundColor: {
            light: "#ffe6e6",
            dark: "#802020",
        },
    },
    {
        title: "Info",
        value: "info",
        icon: Info,
        color: "#507aff",
        backgroundColor: {
            light: "#e6ebff",
            dark: "#203380",
        },
    },
    {
        title: "Success",
        value: "success",
        icon: CheckCircle2,
        color: "#0bc10b",
        backgroundColor: {
            light: "#e6ffe6",
            dark: "#208020",
        },
    },
] as const;

// The Alert block.
export const Alert = createReactBlockSpec(
    {
        type: "alert",
        propSchema: {
            textAlignment: defaultProps.textAlignment,
            textColor: defaultProps.textColor,
            type: {
                default: "warning",
                values: ["warning", "error", "info", "success"],
            },
        },
        content: "inline",
    },
    {
        render: (props) => {
            const alertType = alertTypes.find(
                (a) => a.value === props.block.props.type,
            )!;
            const Icon = alertType.icon;

            return (
                <div className={"alert flex flex-row items-center w-full min-h-[48px] px-3 py-2 rounded-lg my-2 gap-4"} data-alert-type={props.block.props.type} style={{ backgroundColor: alertType.backgroundColor.light }}>
                    {/*Icon which opens a menu to choose the Alert type*/}
                    <Menu withinPortal={false} zIndex={999999} disabled={!props.editor.isEditable}>
                        <Menu.Target>
                            <div className={`alert-icon-wrapper p-1 rounded-sm ${props.editor.isEditable ? 'cursor-pointer hover:bg-black/5' : ''}`} contentEditable={false}>
                                <Icon
                                    className={"alert-icon min-w-[32px] min-h-[32px]"}
                                    data-alert-icon-type={props.block.props.type}
                                    size={32}
                                    color={alertType.color}
                                />
                            </div>
                        </Menu.Target>
                        {/*Dropdown to change the Alert type*/}
                        <Menu.Dropdown>
                            <Menu.Label>Alert Type</Menu.Label>
                            <Menu.Divider />
                            {alertTypes.map((type) => {
                                const ItemIcon = type.icon;

                                return (
                                    <Menu.Item
                                        key={type.value}
                                        leftSection={
                                            <ItemIcon
                                                className={"alert-icon"}
                                                data-alert-icon-type={type.value}
                                                color={type.color}
                                            />
                                        }
                                        onClick={() =>
                                            props.editor.updateBlock(props.block, {
                                                type: "alert",
                                                props: { type: type.value },
                                            })
                                        }
                                    >
                                        {type.title}
                                    </Menu.Item>
                                );
                            })}
                        </Menu.Dropdown>
                    </Menu>

                    {/*Rich text field for user to type in*/}
                    <div className={"inline-content flex-1 max-w-full"} ref={props.contentRef} />
                </div>
            );
        },
    },
);
