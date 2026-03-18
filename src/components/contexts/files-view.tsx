import React from "react";
import { Folder01Icon, File01Icon, PlusSignIcon, Upload04Icon, MoreHorizontalIcon } from "hugeicons-react";

export function FilesView() {
    // Mock data representing a file system
    const folders = [
        { name: "LocalMind DB Schema", items: 4, date: "Yesterday" },
        { name: "Frontend Components", items: 32, date: "Nov 02" },
        { name: "Env Configurations", items: 3, date: "Oct 24" },
    ];

    const files = [
        { name: "schema.ts", size: "8.4 KB", date: "Today, 10:42 AM", type: "typescript" },
        { name: "page.tsx", size: "120 KB", date: "Yesterday, 4:15 PM", type: "typescript" },
        { name: "layout.tsx", size: "4.2 KB", date: "Oct 28", type: "typescript" },
        { name: "globals.css", size: "2.1 KB", date: "Oct 20", type: "css" },
    ];

    return (
        <div className="animate-fade-in pb-24 h-full flex flex-col">
            {/* File Action Bar */}
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-lg font-semibold text-gray-900">Context Files</h2>
                <div className="flex items-center gap-2">
                    <button className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">
                        <Upload04Icon className="size-4" />
                        Upload File
                    </button>
                    <button className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-sm">
                        <PlusSignIcon className="size-4" />
                        New Folder
                    </button>
                </div>
            </div>

            {/* Folders Section */}
            <div className="mb-8">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Folders</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {folders.map((folder, idx) => (
                        <div
                            key={idx}
                            className="group flex flex-col p-4 border border-gray-200 bg-white rounded-xl hover:border-blue-300 hover:shadow-sm cursor-pointer transition-all"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                                    <Folder01Icon className="size-6" />
                                </div>
                                <button className="p-1 rounded-md text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-100 hover:text-gray-900 transition-all">
                                    <MoreHorizontalIcon className="size-4" />
                                </button>
                            </div>
                            <h4 className="text-sm font-semibold text-gray-900 truncate mb-1">{folder.name}</h4>
                            <p className="text-xs text-gray-500 font-medium">{folder.items} items • {folder.date}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Files Section */}
            <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Files</h3>
                <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-medium">
                            <tr>
                                <th className="px-6 py-3 font-medium">Name</th>
                                <th className="px-6 py-3 font-medium">Date Modified</th>
                                <th className="px-6 py-3 font-medium text-right">Size</th>
                                <th className="px-6 py-3 font-medium"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {files.map((file, idx) => (
                                <tr key={idx} className="hover:bg-gray-50/50 cursor-pointer group transition-colors">
                                    <td className="px-6 py-3.5 flex items-center gap-3">
                                        <File01Icon className="size-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                                        <span className="font-medium text-gray-900">{file.name}</span>
                                    </td>
                                    <td className="px-6 py-3.5 text-gray-500">{file.date}</td>
                                    <td className="px-6 py-3.5 text-gray-500 text-right">{file.size}</td>
                                    <td className="px-6 py-3.5 text-right w-12">
                                        <button className="p-1.5 rounded-md text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-200 transition-all">
                                            <MoreHorizontalIcon className="size-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
